from django.http import Http404, HttpResponse
from ninja import Router, Status
from ninja.errors import HttpError

from apps.authentication.security import session_auth
from apps.common import openrouter
from apps.common.ratelimit import throttle
from apps.payments import services as payments
from apps.topics import generate as generation
from apps.topics import owned
from apps.topics.bank import STYLES
from apps.topics.models import Genre, Topic
from apps.topics.schemas import (
    BankOut,
    GeneratedOut,
    GenerateIn,
    GenreIn,
    MineOut,
    OwnedGenreOut,
    PasteIn,
    SharedGenreOut,
    ShareOut,
    TopicIn,
)

api = Router(tags=["topics"])


@api.get("/bank", response=BankOut, exclude_none=True)
def bank(request, response: HttpResponse):
    """The whole built-in bank in one answer, so a respin costs no round
    trip. A settled decision: never fetched per spin, never paginated.

    Public on purpose: it carries no account, so it can be cached for an
    hour by anything between here and the page. A person's own genres
    ride on `/mine`, which does vary by cookie, and that is what keeps
    this one cacheable.
    """
    genres = list(Genre.objects.filter(owner__isnull=True, is_active=True).order_by("sort_order", "id"))
    topics = (
        Topic.objects.filter(genre__in=genres, is_active=True)
        .select_related("genre")
        .order_by("genre__sort_order", "genre_id", "sort_order", "id")
    )
    response["Cache-Control"] = "public, max-age=3600"
    return {
        "genres": [{"slug": g.slug, "name": g.name, "icon": g.icon, "blurb": g.blurb} for g in genres],
        "topics": [
            {"text": t.text, "genre": t.genre.slug, "style": t.style, "slug": t.slug, "image": t.image or None}
            for t in topics
        ],
        "styles": [{"key": key, "label": label, "hint": hint} for key, label, hint in STYLES],
    }


def _writer(request) -> None:
    """Writing is Pro; reading is not. A lapsed subscriber keeps every
    genre they made, still practises them and still has working links -
    what closes is making more. Deleting is deliberately not gated:
    nobody should be locked in with ten genres they cannot tidy."""
    if not payments.is_pro(request.user):
        raise HttpError(403, owned.PRO_ONLY)


def _genre(genre) -> dict:
    topics = _topics(genre)
    return {
        "slug": genre.slug,
        "name": genre.name,
        "icon": genre.icon,
        "topic_count": len(topics),
        "share_token": genre.share_token,
        "topics": topics,
        "own_styles": owned.own_styles(genre),
    }


def _topics(genre) -> list[dict]:
    return [
        {"id": t.id, "text": t.text, "style": t.style, "style_label": owned.label_for(t.style)}
        for t in owned.topics_of(genre)
    ]


@api.get("/mine", auth=session_auth, response=MineOut)
def mine(request, response: HttpResponse):
    """The genres this account owns, for the list page and the picker.
    Private to the cookie, so never cached; the built-in bank beside it
    is public and cached for an hour, which is the whole reason the two
    are separate calls."""
    response["Cache-Control"] = "private, no-store"
    return {
        "genres": [_genre(genre) for genre in owned.mine(request.user)],
        "max_genres": owned.MAX_GENRES,
        "max_topics": owned.MAX_TOPICS,
        "can_generate": openrouter.enabled(),
        "generations_left": generation.left(request.user),
    }


@api.post("/mine", auth=session_auth, response={201: OwnedGenreOut})
@throttle("genres", "30/hour")
def create(request, payload: GenreIn):
    _writer(request)
    genre = owned.create(request.user, payload.name, payload.icon)
    return Status(201, _genre(genre))


@api.get("/mine/{slug}", auth=session_auth, response=OwnedGenreOut)
def one(request, slug: str, response: HttpResponse):
    response["Cache-Control"] = "private, no-store"
    return _genre(owned.by_slug(request.user, slug))


@api.delete("/mine/{slug}", auth=session_auth, response={204: None})
def remove(request, slug: str):
    """Not gated on Pro: a lapsed account has to be able to tidy up."""
    owned.delete(owned.by_slug(request.user, slug))
    return Status(204, None)


@api.post("/mine/{slug}/topics", auth=session_auth, response=OwnedGenreOut)
# The one route here that can write two hundred rows at a time. Keyed on
# the account, since a paste is a person deciding, not a page loading.
@throttle("genre-topics", "60/hour")
def paste(request, slug: str, payload: PasteIn):
    _writer(request)
    genre = owned.by_slug(request.user, slug)
    owned.add_topics(genre, payload.text, payload.default_style)
    return _genre(genre)


@api.patch("/mine/{slug}/topics/{topic_id}", auth=session_auth, response=OwnedGenreOut)
def edit(request, slug: str, topic_id: int, payload: TopicIn):
    _writer(request)
    genre = owned.by_slug(request.user, slug)
    owned.edit_topic(genre, topic_id, payload.text, payload.style)
    return _genre(genre)


@api.delete("/mine/{slug}/topics/{topic_id}", auth=session_auth, response=OwnedGenreOut)
def drop(request, slug: str, topic_id: int):
    genre = owned.by_slug(request.user, slug)
    owned.remove_topic(genre, topic_id)
    return _genre(genre)


@api.post("/mine/{slug}/generate", auth=session_auth, response=GeneratedOut)
# Slower and dearer than anything else here, so it is throttled in front
# of the allowance as well: the allowance is the month's ceiling and this
# is the minute's.
@throttle("genre-generate", "10/hour")
def write_topics(request, slug: str, payload: GenerateIn):
    """Ask a model for twenty lines and add what comes back.

    404 without a key, the same 404 as any route that does not exist,
    rather than a button that is drawn and then refuses. The allowance is
    spent whether or not the model answers, so a failure is a 502 and the
    count on the page goes down: an account that could retry a failure
    for free would have no ceiling at all.
    """
    if not openrouter.enabled():
        raise Http404
    _writer(request)
    genre = owned.by_slug(request.user, slug)
    try:
        added, remaining = generation.generate(request.user, genre, payload.prompt)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    except generation.NoAllowanceLeft as exc:
        raise HttpError(400, str(exc)) from exc
    except openrouter.ModelError as exc:
        raise HttpError(502, f"{exc} Nothing was added; that attempt still counts.") from exc
    return {"genre": _genre(genre), "added": added, "generations_left": remaining}


@api.post("/mine/{slug}/share", auth=session_auth, response=ShareOut)
def start_sharing(request, slug: str):
    _writer(request)
    return {"token": owned.share(owned.by_slug(request.user, slug))}


@api.delete("/mine/{slug}/share", auth=session_auth, response=ShareOut)
def stop_sharing(request, slug: str):
    """Not gated either: turning sharing off is how somebody takes a page
    back, and that must never depend on a subscription being live."""
    owned.unshare(owned.by_slug(request.user, slug))
    return {"token": None}


@api.get("/shared/{token}", response=SharedGenreOut)
def shared(request, token: str, response: HttpResponse):
    """A shared genre, to anybody holding the link. No account needed:
    viewing is free, making is Pro. Nothing is copied, so the link always
    shows the list as it is now, and the owner turning sharing off is
    what makes it stop resolving."""
    genre = owned.by_token(token)
    if genre is None or genre.owner_id is None:
        raise HttpError(404, owned.NO_GENRE)
    response["Cache-Control"] = "private, no-store"
    return {
        "name": genre.name,
        "icon": genre.icon,
        "owner_name": genre.owner.name or "",
        "token": token,
        "topics": _topics(genre),
    }
