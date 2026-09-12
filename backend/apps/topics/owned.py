"""The genres people write for themselves.

Not a second set of genre tables. An owned genre is a `Genre` row with an
owner, which is what removes v0's `PackTopic`, its `pack:` slug namespace
and the second row shape its picker had to know about. The seeder never
reads past `owner IS NULL`, and that one clause is what lets the public
bank and somebody's private list share a table.

What hangs under it follows the genre's mode: prompts are `Topic` rows and
passages are `TongueTwister` rows. Every function here that takes a genre
and touches its rows branches once, at the top, on `is_read` - and that
branch is the honest one, because the two kinds are pasted differently,
capped differently and carry different columns.

Making is Pro and reading is free, sharing included: a link somebody was
sent has to keep working after a subscription lapses, or sharing is a
thing that quietly breaks other people's bookmarks.
"""

import secrets

from django.db import transaction
from django.db.models import Count, Q
from django.utils.text import slugify
from ninja.errors import HttpError

from apps.topics import bank, pictures
from apps.topics.icons import valid_icon
from apps.topics.models import Genre, TongueTwister, Topic

# Genres per account, and topics in each. Not arbitrary: home ships the
# whole bank inline so another topic costs no round trip, and these ride
# in that payload. Unbounded, they would turn the one page that has to be
# instant into the one page that is not.
MAX_GENRES = 10
MAX_TOPICS = 200

# Passages in a read genre, and far fewer than topics, because a passage is
# a hundred words rather than a line. Two hundred of them is 140KB of text
# on a page that server-renders its own bank, which is the one page that
# has to be the tool the moment it loads. Fifty is more than anybody has
# written by hand and still a page that arrives.
MAX_PASSAGES = 50

# What a passage somebody writes is filed as until they say otherwise.
DEFAULT_LEVEL = "hard"

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
TOO_MANY_PASSAGES = f"A warm-up holds {MAX_PASSAGES} passages, and this paste would go over."
PASSAGE_TOO_SHORT = (
    f"A passage needs at least {bank.MIN_PASSAGE} characters, which is about twenty seconds of reading aloud."
)
PASSAGE_TOO_LONG = f"A passage stops at {bank.MAX_PASSAGE} characters. Split it into two."
NO_PASSAGE = "No such passage."
READ_NO_PICTURES = "A warm-up is words on a scroller, so it takes no pictures."
NAME_TAKEN = "You already have a genre with that name."
NEEDS_NAME = "Give the genre a name."
NEEDS_TEXT = "A topic needs some words."
NO_GENRE = "No such genre."
NO_TOPIC = "No such topic."
ALREADY_HERE = "That topic is already in this genre."
PRO_ONLY = "Pro is needed to write your own genres."
PICTURES_NO_SHARING = "A genre with your own pictures in it cannot be shared."
SHARED_NO_PICTURES = "Stop sharing this genre before adding a picture to it."

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
    # Counted per table and added afterwards rather than in one annotation:
    # two aggregates over two joins in one query multiply each other, and
    # `distinct` is what keeps each honest. A genre holds one kind or the
    # other, so one of the two is always zero.
    topics = Count("topics", filter=Q(topics__is_active=True), distinct=True)
    passages = Count("tongue_twisters", filter=Q(tongue_twisters__is_active=True), distinct=True)
    genres = Genre.objects.filter(owner=user).annotate(_topics=topics, _passages=passages).order_by("id")
    rows = list(genres)
    for genre in rows:
        genre.topic_count = genre._topics + genre._passages
    return rows


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


def passages_of(genre: Genre) -> list[TongueTwister]:
    return list(genre.tongue_twisters.filter(is_active=True).order_by("sort_order", "id"))


def rows_of(genre: Genre) -> list[Topic] | list[TongueTwister]:
    """Whatever this genre holds, for a caller that only needs to count or
    list them and does not care which kind they are."""
    return passages_of(genre) if is_read(genre) else topics_of(genre)


def valid_mode(mode: str | None) -> str:
    """One of the two we offer, or the ordinary one. A fixed set with a
    validator in front of it, like the icon and the accent: this value
    decides which round a page runs, and the one thing it must never be is
    whatever was posted."""
    return bank.MODE_READ if mode == bank.MODE_READ else bank.MODE_SPEAK


def is_read(genre: Genre) -> bool:
    return genre.mode == bank.MODE_READ


def cap_for(genre: Genre) -> int:
    return MAX_PASSAGES if is_read(genre) else MAX_TOPICS


def create(user, name: str, icon: str, mode: str | None = None) -> Genre:
    tidy = " ".join(name.split())[:60]
    slug = slugify(tidy)[:60]
    if not tidy or not slug:
        raise HttpError(400, NEEDS_NAME)
    if Genre.objects.filter(owner=user).count() >= MAX_GENRES:
        raise HttpError(400, TOO_MANY_GENRES)
    if Genre.objects.filter(owner=user, slug=slug).exists():
        raise HttpError(400, NAME_TAKEN)
    return Genre.objects.create(
        owner=user, name=tidy, slug=slug, icon=valid_icon(icon), sort_order=0, mode=valid_mode(mode)
    )


def check_passage(line: str) -> str:
    """A passage, or the reason it is not one. The bounds are the feature's:
    under two hundred characters there is nothing to scroll past, and over
    twelve hundred the scroller is asking somebody to read for three
    minutes without stopping."""
    if len(line) < bank.MIN_PASSAGE:
        raise HttpError(400, PASSAGE_TOO_SHORT)
    if len(line) > bank.MAX_PASSAGE:
        raise HttpError(400, PASSAGE_TOO_LONG)
    return line


def parse_passages(text: str) -> list[str]:
    """A paste of passages, split on blank lines rather than on newlines.

    A prompt is a line and a passage is a paragraph, so the two cannot
    share a parser: splitting a passage per line would file every sentence
    of it as a passage of its own, and each of those would then be refused
    for being too short. A blank line between them is what somebody types
    anyway and what a document pasted in already has.

    Nothing carries a style tail here, and nothing carries a level: in a
    hundred-word paragraph a trailing comma clause belongs to the sentence
    far more often than it is a tag, and difficulty is two values set on
    the row afterwards rather than typed fifty times into a paste.
    """
    out: list[str] = []
    seen: set[str] = set()
    for block in text.split("\n\n"):
        line = " ".join(block.split())
        if not line:
            continue
        check_passage(line)
        key = line.lower()
        if key not in seen:
            seen.add(key)
            out.append(line)
    return out


@transaction.atomic
def add_topics(genre: Genre, text: str, default_style: str = DEFAULT_STYLE) -> int:
    """Import a paste. Returns how many rows landed.

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


@transaction.atomic
def add_passages(genre: Genre, text: str) -> int:
    """The same import, into the other table. Every difference from the one
    above is a difference between a prompt and a paragraph: the paste splits
    on blank lines, the cap is fifty rather than two hundred, there is no
    style to carry, and a fresh row is filed at the default level for the
    owner to change per row."""
    lines = parse_passages(text)
    if not lines:
        return 0
    held = list(genre.tongue_twisters.all())
    have = {passage.text.lower() for passage in held}
    fresh = [line for line in lines if line.lower() not in have]
    if len(held) + len(fresh) > MAX_PASSAGES:
        raise HttpError(400, TOO_MANY_PASSAGES)

    slugs = {passage.slug for passage in held}
    order = max((passage.sort_order for passage in held), default=0)
    for line in fresh:
        order += 1
        TongueTwister.objects.create(
            genre=genre, text=line, slug=_free_slug(line, slugs), level=DEFAULT_LEVEL, sort_order=order
        )
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
    """Change one prompt and the style it is asked in. Scoped to the genre,
    so an id from somebody else's is a 404 rather than an edit."""
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


def edit_passage(genre: Genre, passage_id: int, text: str, level: str) -> TongueTwister:
    """The same edit on the other table. A passage is checked against the
    feature's bounds rather than truncated to a prompt's, and its level is
    one of two fixed values rather than anything somebody coins: a level
    nobody offered is filed at the default rather than refused, because the
    words are what the owner came to change."""
    passage = genre.tongue_twisters.filter(pk=passage_id).first()
    if passage is None:
        raise HttpError(404, NO_PASSAGE)
    line = " ".join(text.split())[: bank.MAX_PASSAGE]
    if not line:
        raise HttpError(400, NEEDS_TEXT)
    check_passage(line)
    if genre.tongue_twisters.filter(text=line).exclude(pk=passage.pk).exists():
        raise HttpError(400, ALREADY_HERE)
    passage.text = line
    passage.level = level if level in bank.LEVEL_KEYS else DEFAULT_LEVEL
    passage.slug = _free_slug(line, {row.slug for row in genre.tongue_twisters.exclude(pk=passage.pk)})
    passage.save(update_fields=["text", "level", "slug"])
    return passage


def own_styles(genre: Genre) -> list[str]:
    """The coined styles already in this genre, so the second topic to
    use one picks it from a list instead of retyping it into existence."""
    return sorted({topic.style for topic in genre.topics.all() if topic.style not in bank.STYLE_KEYS})


@transaction.atomic
def add_picture(genre: Genre, user_id: int, upload, text: str, style: str) -> Topic:
    """One uploaded picture, with the sentence that goes over it.

    The file is stored before the row, and the row inside a transaction:
    an orphaned object in the bucket costs a fraction of a penny, while a
    row pointing at a file that was never written is a topic that draws
    a broken image every time it is drawn.
    """
    # A warm-up takes none: the words are the whole of what is on screen
    # while they scroll, and `image` is a column on the other table. The
    # editor never draws the control, and the route refused nothing until
    # this line existed - a picture posted at a read genre landed as a
    # 200-character `Topic` row under it, past the fifty-passage cap, and
    # nothing anywhere drew it.
    if is_read(genre):
        raise HttpError(400, READ_NO_PICTURES)
    line = " ".join(text.split())[:bank.MAX_TEXT]
    if not line:
        raise HttpError(400, NEEDS_TEXT)
    if genre.share_token:
        raise HttpError(400, SHARED_NO_PICTURES)
    held = list(genre.topics.all())
    if len(held) >= MAX_TOPICS:
        raise HttpError(400, TOO_MANY_TOPICS)
    if line.lower() in {topic.text.lower() for topic in held}:
        raise HttpError(400, ALREADY_HERE)

    key = pictures.store(user_id, upload)
    order = max((topic.sort_order for topic in held), default=0) + 1
    return Topic.objects.create(
        genre=genre,
        text=line,
        slug=_free_slug(line, {topic.slug for topic in held}),
        # `coin_style`, not `valid_style`: a picture is added one at a
        # time from the editor, which is exactly where coining one is
        # allowed. The paste is the place that refuses to, because there
        # every comma would coin one.
        style=coin_style(style),
        image=key,
        sort_order=order,
    )


def remove_topic(genre: Genre, topic_id: int) -> None:
    """Really gone, unlike a bank topic. Nothing public names it and no
    unique text has to stay reserved, so there is nothing a tombstone
    would buy. The uploaded file goes with the row, or a cancelled
    subscriber's bucket grows forever with pictures nothing points at."""
    if is_read(genre):
        genre.tongue_twisters.filter(pk=topic_id).delete()
        return
    for topic in genre.topics.filter(pk=topic_id):
        pictures.remove(topic.image)
    genre.topics.filter(pk=topic_id).delete()


def delete(genre: Genre) -> None:
    """The genre's own uploads go with it, for the reason above. Only
    uploads: a built-in's picture is a file in the repository and is not
    this genre's to delete. Its rows of either kind go by cascade."""
    for topic in genre.topics.exclude(image=""):
        pictures.remove(topic.image)
    genre.delete()


def has_pictures(genre: Genre) -> bool:
    return genre.topics.exclude(image="").exists()


def share(genre: Genre) -> str:
    """Turn sharing on, or hand back the link already in use. Idempotent,
    as the streak's is: pressing the button twice must not break a link
    somebody has already sent.

    A genre holding uploaded pictures cannot be shared at all (owner's
    call, 2026-09-09). `/g/<token>` needs no account, so sharing one
    would make this site a place to host arbitrary images behind a link,
    and that is a moderation problem rather than a feature.
    """
    if has_pictures(genre):
        raise HttpError(400, PICTURES_NO_SHARING)
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
