"""The genres people write for themselves.

Not a second pair of tables. An owned genre is a `Genre` row with an
owner and its topics are `Topic` rows, which is what removes v0's
`PackTopic`, its `pack:` slug namespace and the second row shape its
picker had to know about. The seeder never reads past `owner IS NULL`,
and that one clause is what lets the public bank and somebody's private
list share a table.

Making is Pro and reading is free, sharing included: a link somebody was
sent has to keep working after a subscription lapses, or sharing is a
thing that quietly breaks other people's bookmarks.
"""

import secrets

from django.db import transaction
from django.db.models import Count, Q
from django.utils.text import slugify
from ninja.errors import HttpError

from apps.topics import bank
from apps.topics.icons import valid_icon
from apps.topics.models import Genre, Topic

# Genres per account, and topics in each. Not arbitrary: home ships the
# whole bank inline so another topic costs no round trip, and these ride
# in that payload. Unbounded, they would turn the one page that has to be
# instant into the one page that is not.
MAX_GENRES = 10
MAX_TOPICS = 200

# A style somebody named themselves. Short, because it renders at the end
# of a row beside the topic and a long one pushes the topic around.
MAX_STYLE = 24

DEFAULT_STYLE = "just-talk"

# 16 bytes as base64url, the same as a shared streak's: 128 bits is not a
# thing anybody enumerates, and it is short enough to sit in a message
# without wrapping.
TOKEN_BYTES = 16

TOO_MANY_GENRES = f"That is {MAX_GENRES} genres, which is the most an account can hold."
TOO_MANY_TOPICS = f"A genre holds {MAX_TOPICS} topics, and this paste would go over."
NAME_TAKEN = "You already have a genre with that name."
NEEDS_NAME = "Give the genre a name."
NEEDS_TEXT = "A topic needs some words."
NO_GENRE = "No such genre."
NO_TOPIC = "No such topic."
ALREADY_HERE = "That topic is already in this genre."
PRO_ONLY = "Pro is needed to write your own genres."

# What a pasted line's tail may say. Both the slug and the label, because
# "Tipping should end, hot take" is what somebody types and "hot-take" is
# what a spreadsheet column holds.
TAILS: dict[str, str] = {}
for _key, _label, _hint in bank.STYLES:
    if _key != bank.SURPRISE:
        TAILS[_key] = _key
        TAILS[_label.lower()] = _key
        TAILS[slugify(_label)] = _key


def label_for(style: str) -> str:
    """What a style is called on a page. A coined one reads as itself: it
    was stored as the words somebody typed precisely so that nothing here
    has to guess them back."""
    for key, label, _hint in bank.STYLES:
        if key == style:
            return label
    return style


def valid_style(value: str | None) -> str:
    """One of the styles we offer, or the default. The strict one, used
    by the paste: if a paste could coin a style, every comma would."""
    return value if value in bank.STYLE_KEYS else DEFAULT_STYLE


def coin_style(value: str) -> str:
    """What the editor's style field means: one of ours, or one they
    named. A coined style is stored as the words typed and never
    slugified, because "IELTS style" read back as "Ielts style" is a tag
    that restyles itself; and typing the name of a built-in gets the
    built-in rather than a private copy the style filter cannot see."""
    named = " ".join(value.split())[:MAX_STYLE]
    if not named:
        return DEFAULT_STYLE
    return TAILS.get(named.lower(), named)


def parse(text: str, default_style: str = DEFAULT_STYLE) -> list[tuple[str, str]]:
    """A paste into (topic, style) pairs.

    Every line is a topic. A line may end with a style ("Tipping should
    end, hot take") and the tail is read as one only when it is one,
    because otherwise the comma belongs to the sentence, which is the
    common case. That single rule is why a list typed by hand and a
    column pasted out of a spreadsheet both land correctly with nothing
    to choose first; the default underneath is what an untagged line
    gets, so twenty questions in one style cost one pick instead of
    twenty tails.

    Blank lines are skipped, since every textarea ends in one, and a
    repeat inside the paste is dropped, keeping the first.
    """
    fallback = valid_style(default_style)
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw in text.splitlines():
        line = raw.strip().strip(",").strip()
        if not line:
            continue
        style = fallback
        head, comma, tail = line.rpartition(",")
        if comma and (guess := TAILS.get(tail.strip().lower())):
            line, style = head.strip(), guess
        line = " ".join(line.split())[: bank.MAX_TEXT]
        key = line.lower()
        if line and key not in seen:
            seen.add(key)
            out.append((line, style))
    return out


def mine(user) -> list[Genre]:
    """Every genre this account owns, in the order they were made, each
    carrying how many live topics it holds. A stranger owns none, and
    answering that here saves every caller a guard."""
    if user is None or not getattr(user, "is_authenticated", False):
        return []
    live = Count("topics", filter=Q(topics__is_active=True))
    return list(Genre.objects.filter(owner=user).annotate(topic_count=live).order_by("id"))


def by_slug(user, slug: str) -> Genre:
    """One genre, and only if this account owns it. Ownership is in the
    lookup rather than checked after it, so a route cannot forget it, and
    a slug somebody else holds is a 404 rather than a refusal that
    confirms it exists."""
    if user is None or not getattr(user, "is_authenticated", False):
        raise HttpError(404, NO_GENRE)
    found = Genre.objects.filter(owner=user, slug=slug).first()
    if found is None:
        raise HttpError(404, NO_GENRE)
    return found


def by_token(token: str) -> Genre | None:
    """The genre behind a share link, or None. No account needed: viewing
    is free and the link is the whole of the permission."""
    if not token:
        return None
    return Genre.objects.filter(share_token=token).select_related("owner").first()


def topics_of(genre: Genre) -> list[Topic]:
    return list(genre.topics.filter(is_active=True).order_by("sort_order", "id"))


def create(user, name: str, icon: str) -> Genre:
    tidy = " ".join(name.split())[:60]
    slug = slugify(tidy)[:60]
    if not tidy or not slug:
        raise HttpError(400, NEEDS_NAME)
    if Genre.objects.filter(owner=user).count() >= MAX_GENRES:
        raise HttpError(400, TOO_MANY_GENRES)
    if Genre.objects.filter(owner=user, slug=slug).exists():
        raise HttpError(400, NAME_TAKEN)
    return Genre.objects.create(owner=user, name=tidy, slug=slug, icon=valid_icon(icon), sort_order=0)


@transaction.atomic
def add_topics(genre: Genre, text: str, default_style: str = DEFAULT_STYLE) -> int:
    """Import a paste. Returns how many lines landed.

    Over the ceiling refuses the whole paste rather than taking a prefix
    of it: silently keeping the first thirty of somebody's ninety is
    worse than saying no, because they cannot see which thirty.
    """
    lines = parse(text, default_style)
    if not lines:
        return 0
    held = list(genre.topics.all())
    have = {topic.text.lower() for topic in held}
    fresh = [(line, style) for line, style in lines if line.lower() not in have]
    if len(held) + len(fresh) > MAX_TOPICS:
        raise HttpError(400, TOO_MANY_TOPICS)

    slugs = {topic.slug for topic in held}
    order = max((topic.sort_order for topic in held), default=0)
    for line, style in fresh:
        order += 1
        Topic.objects.create(genre=genre, text=line, slug=_free_slug(line, slugs), style=style, sort_order=order)
    return len(fresh)


def _free_slug(text: str, taken: set[str]) -> str:
    """A slug nothing in this genre already holds. Two topics can differ
    by punctuation alone ("Ready?" and "Ready") and slug to the same
    thing, which the table refuses; the row is the topic, so the second
    one gets a suffix rather than the paste getting a refusal."""
    base = bank.slugify_topic(text) or "topic"
    slug, n = base, 1
    while slug in taken:
        n += 1
        slug = f"{base[:215]}-{n}"
    taken.add(slug)
    return slug


def edit_topic(genre: Genre, topic_id: int, text: str, style: str) -> Topic:
    """Change one line and its style. Scoped to the genre, so an id from
    somebody else's is a 404 rather than an edit."""
    topic = genre.topics.filter(pk=topic_id).first()
    if topic is None:
        raise HttpError(404, NO_TOPIC)
    line = " ".join(text.split())[: bank.MAX_TEXT]
    if not line:
        raise HttpError(400, NEEDS_TEXT)
    if genre.topics.filter(text=line).exclude(pk=topic.pk).exists():
        raise HttpError(400, ALREADY_HERE)
    coined = coin_style(style)
    # A style the genre already holds wins on spelling, so typing "panel
    # round" beside an existing "Panel round" joins it rather than
    # sitting next to it looking like a mistake.
    for held in own_styles(genre):
        if held.lower() == coined.lower():
            coined = held
            break
    topic.text, topic.style = line, coined
    topic.slug = _free_slug(line, {row.slug for row in genre.topics.exclude(pk=topic.pk)})
    topic.save(update_fields=["text", "style", "slug"])
    return topic


def own_styles(genre: Genre) -> list[str]:
    """The coined styles already in this genre, so the second topic to
    use one picks it from a list instead of retyping it into existence."""
    return sorted({topic.style for topic in genre.topics.all() if topic.style not in bank.STYLE_KEYS})


def remove_topic(genre: Genre, topic_id: int) -> None:
    """Really gone, unlike a bank topic. Nothing public names it and no
    unique text has to stay reserved, so there is nothing a tombstone
    would buy."""
    genre.topics.filter(pk=topic_id).delete()


def delete(genre: Genre) -> None:
    genre.delete()


def share(genre: Genre) -> str:
    """Turn sharing on, or hand back the link already in use. Idempotent,
    as the streak's is: pressing the button twice must not break a link
    somebody has already sent."""
    if not genre.share_token:
        genre.share_token = secrets.token_urlsafe(TOKEN_BYTES)
        genre.save(update_fields=["share_token"])
    return genre.share_token


def unshare(genre: Genre) -> None:
    """The token is cleared, so the link somebody was sent dies the
    moment the switch moves and sharing again mints a new one. Parking it
    and handing the same link back would let everybody still holding the
    old one in again the second sharing was turned on."""
    if genre.share_token:
        genre.share_token = None
        genre.save(update_fields=["share_token"])
