"""Writing the built-in bank into the tables.

Idempotent, and scoped to rows without an owner: the seeder never reads
past `owner IS NULL`, which is the one rule that lets people's own genres
share the tables with the public bank. It overwrites what it owns on those
rows (a built-in genre's name, icon, blurb and order come back from
`bank.GENRES`; a row's genre, style or level and order from its file),
which is the trade for having one place the bank is written from, and why
it is a command rather than something that happens while you are not
looking.

Two passes under the one genre pass, because there are two tables under
`Genre`: prompts into `Topic`, passages into `TongueTwister`. They share
the shape of the work and not a line of the work itself, which is what
`_sweep` is for.
"""

from django.db import transaction

from apps.topics import bank
from apps.topics.models import Genre, TongueTwister, Topic


@transaction.atomic
def seed_topics() -> tuple[int, int]:
    """Returns (genres written, topics written)."""
    built_in: dict[str, Genre] = {g.slug: g for g in Genre.objects.filter(owner__isnull=True)}

    declared = bank.all_genres()

    for order, (slug, name, icon, blurb, mode) in enumerate(declared):
        genre = built_in.get(slug) or Genre(slug=slug)
        genre.name, genre.icon, genre.blurb, genre.sort_order, genre.is_active = name, icon, blurb, order, True
        genre.mode = mode
        genre.save()
        built_in[slug] = genre

    speak = [slug for slug, _n, _i, _b, mode in declared if mode != bank.MODE_READ]
    read = [slug for slug, _n, _i, _b, mode in declared if mode == bank.MODE_READ]
    topics = _seed_topics(built_in, speak)
    passages = _seed_passages(built_in, read)

    # A genre that has left GENRES goes, decided after the rows have moved
    # so a merge is one run and not two. Merging genres moves their topics
    # but leaves the emptied rows behind, and a genre still on offer that
    # yields nothing is a worse failure than a missing one: it looks like it
    # works. Deleted rather than deactivated once it is empty, because a
    # finished run names its genre by slug with no foreign key, so the row
    # is not what keeps that history readable. One that still owns rows of
    # either kind is deactivated instead: that is a broken state (a genre
    # left the list while its file still fed it), and the answer is to stop
    # offering it, not to delete forty rows on the way past.
    live = {slug for slug, *_ in declared}
    for slug, genre in list(built_in.items()):
        if slug in live:
            continue
        if genre.topics.exists() or genre.tongue_twisters.exists():
            genre.is_active = False
            genre.save(update_fields=["is_active"])
        else:
            genre.delete()

    return len(declared), topics + passages


def _seed_topics(built_in: dict[str, Genre], slugs: list[str]) -> int:
    """The prompts. Upserted by text across the whole built-in bank, so a
    topic that moves from one file to another keeps its row and its id. The
    same line in two files would then migrate between them on every run;
    refused loudly instead."""
    existing: dict[str, Topic] = {t.text: t for t in Topic.objects.filter(genre__owner__isnull=True)}
    claimed: dict[str, str] = {}
    seen: set[int] = set()
    written = 0
    for slug in slugs:
        rows = bank.load(slug)
        if rows is None:
            continue
        genre = built_in[slug]
        for order, item in enumerate(rows):
            text = item["text"]
            if text in claimed:
                raise ValueError(f"{text!r} appears in both {claimed[text]}.json and {slug}.json")
            claimed[text] = slug
            topic = existing.get(text)
            if topic is None:
                # New rows are live; existing ones keep whatever the admin
                # decided, because a dud switched off there must stay off.
                # The slug is set once, on the row's first write, and never
                # again: it is what `/?topic=` links resolve on, so changing
                # a file must not break a link somebody already sent.
                topic = Topic(text=text, slug=item["slug"], is_active=True)
                existing[text] = topic
            topic.genre, topic.style, topic.sort_order = genre, item["style"], order
            topic.image = item["image"]
            topic.save()
            seen.add(topic.id)
            written += 1
    _sweep(Topic.objects.filter(genre__owner__isnull=True), seen)
    return written


def _seed_passages(built_in: dict[str, Genre], slugs: list[str]) -> int:
    """The tongue twisters. Upserted by text the same way, and by its own
    loader: a passage carries a level and a slug it named itself, and no
    picture and no style, so there is nothing here to share with the pass
    above beyond the sweep at the end."""
    existing: dict[str, TongueTwister] = {t.text: t for t in TongueTwister.objects.filter(genre__owner__isnull=True)}
    claimed: dict[str, str] = {}
    seen: set[int] = set()
    written = 0
    for slug in slugs:
        rows = bank.load_passages(slug)
        if rows is None:
            continue
        genre = built_in[slug]
        for order, item in enumerate(rows):
            text = item["text"]
            if text in claimed:
                raise ValueError(f"{text!r} appears in both {claimed[text]}.json and {slug}.json")
            claimed[text] = slug
            passage = existing.get(text)
            if passage is None:
                passage = TongueTwister(text=text, slug=item["slug"], is_active=True)
                existing[text] = passage
            passage.genre, passage.level, passage.sort_order = genre, item["level"], order
            passage.save()
            seen.add(passage.id)
            written += 1
    _sweep(TongueTwister.objects.filter(genre__owner__isnull=True), seen)
    return written


def _sweep(rows, seen: set[int]) -> None:
    """A row that left every file is switched off, never deleted: re-adding
    it later must not trip the unique constraint, and a finished run may
    still name it."""
    rows.filter(is_active=True).exclude(id__in=seen).update(is_active=False)
