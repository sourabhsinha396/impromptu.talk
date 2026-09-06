"""Writing the built-in bank into the tables.

Idempotent, and scoped to rows without an owner: the seeder never reads
past `owner IS NULL`, which is the one rule that lets people's own genres
share the tables with the public bank. It overwrites what it owns on those
rows (a built-in genre's name, icon, blurb and order come back from
`bank.GENRES`; a topic's genre, style and order from its file), which is
the trade for having one place the bank is written from, and why it is a
command rather than something that happens while you are not looking.
"""

from django.db import transaction

from apps.topics import bank
from apps.topics.models import Genre, Topic


@transaction.atomic
def seed_topics() -> tuple[int, int]:
    """Returns (genres written, topics written)."""
    built_in: dict[str, Genre] = {g.slug: g for g in Genre.objects.filter(owner__isnull=True)}

    for order, (slug, name, icon, blurb) in enumerate(bank.GENRES):
        genre = built_in.get(slug) or Genre(slug=slug)
        genre.name, genre.icon, genre.blurb, genre.sort_order, genre.is_active = name, icon, blurb, order, True
        genre.save()
        built_in[slug] = genre

    # Upserted by text across the whole built-in bank, so a topic that moves
    # from one file to another keeps its row and its id. The same line in
    # two files would then migrate between them on every run; refused
    # loudly instead.
    existing: dict[str, Topic] = {t.text: t for t in Topic.objects.filter(genre__owner__isnull=True)}
    claimed: dict[str, str] = {}
    seen: set[int] = set()
    written = 0
    for slug, *_ in bank.GENRES:
        topics = bank.load(slug)
        if topics is None:
            continue
        genre = built_in[slug]
        for order, item in enumerate(topics):
            text = item["text"]
            if text in claimed:
                raise ValueError(f"{text!r} appears in both {claimed[text]}.json and {slug}.json")
            claimed[text] = slug
            topic = existing.get(text)
            if topic is None:
                # New rows are live; existing ones keep whatever the admin
                # decided, because a dud switched off there must stay off.
                topic = Topic(text=text, slug=bank.slugify_topic(text), is_active=True)
                existing[text] = topic
            topic.genre, topic.style, topic.sort_order = genre, item["style"], order
            topic.save()
            seen.add(topic.id)
            written += 1

    # A topic that left every file is switched off, never deleted: re-adding
    # it later must not trip the unique constraint, and a finished run may
    # still name it.
    Topic.objects.filter(genre__owner__isnull=True, is_active=True).exclude(id__in=seen).update(is_active=False)

    # A genre that has left GENRES goes, decided after the topics have moved
    # so a merge is one run and not two. Merging genres moves their topics
    # but leaves the emptied rows behind, and a genre still on offer that
    # yields nothing is a worse failure than a missing one: it looks like it
    # works. Deleted rather than deactivated once it is empty, because a
    # finished run names its genre by slug with no foreign key, so the row
    # is not what keeps that history readable. One that still owns topics is
    # deactivated instead: that is a broken state (a genre left the list
    # while its file still fed it), and the answer is to stop offering it,
    # not to delete forty topics on the way past.
    live = {slug for slug, *_ in bank.GENRES}
    for slug, genre in list(built_in.items()):
        if slug in live:
            continue
        if genre.topics.exists():
            genre.is_active = False
            genre.save(update_fields=["is_active"])
        else:
            genre.delete()

    return len(bank.GENRES), written
