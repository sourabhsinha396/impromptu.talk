from django.http import HttpResponse
from ninja import Router

from apps.topics.bank import STYLES
from apps.topics.models import Genre, Topic
from apps.topics.schemas import BankOut

api = Router(tags=["topics"])


@api.get("/bank", response=BankOut)
def bank(request, response: HttpResponse):
    """The whole built-in bank in one answer, so a respin costs no round
    trip. A settled decision: never fetched per spin, never paginated.

    Public on purpose: it carries no account, so it can be cached for an
    hour by anything between here and the page. A person's own genres
    ride on a second call that does vary by cookie (card 29), which is
    what keeps this one cacheable.
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
        "topics": [{"text": t.text, "genre": t.genre.slug, "style": t.style, "slug": t.slug} for t in topics],
        "styles": [{"key": key, "label": label, "hint": hint} for key, label, hint in STYLES],
    }
