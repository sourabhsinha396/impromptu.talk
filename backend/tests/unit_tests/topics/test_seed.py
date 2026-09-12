"""The bank and the seeder. These fail silently in every direction (a genre
that yields nothing, a topic that quietly changes genre, a dud that comes
back to life), so they carry the tests."""

import json

import pytest

from apps.topics import bank
from apps.topics.icons import ICONS
from apps.topics.models import Genre, TongueTwister, Topic
from apps.topics.services import seed_topics
from tests.unit_tests import factories

#: Every line in every file, read once at import so a test that monkeypatches
#: `bank.load` still compares against the real bank. Derived rather than
#: typed: these tests are about rows moving between genres and never about
#: how many topics somebody has written, and a literal here failed the whole
#: suite every time one was added.
BANK_SIZE = sum(len(bank.load(slug) or ()) for slug, *_ in bank.GENRES)

#: The passages, counted apart from the prompts because they are a table
#: apart. `seed_topics` returns the two added together, which is the only
#: place the total is still one number.
PASSAGE_COUNT = sum(len(bank.load_passages(slug) or ()) for slug, *_ in bank.WARM_UPS)

#: The picture half of it. A floor rather than a literal for the same
#: reason, and because an empty picture bank is the one state that breaks
#: picture mode outright.
PICTURES = sum(1 for slug, *_ in bank.GENRES for t in bank.load(slug) or () if t["image"])

#: The warm-ups are counted apart from the ten everywhere below, because
#: almost nothing true of a speak genre is true of a read one: a passage is
#: a paragraph rather than a sentence, it carries a level rather than a
#: style, it lives in its own table, and forty of them would be five
#: thousand words of original writing rather than forty lines.
WARM_UP_SLUGS = {slug for slug, *_ in bank.WARM_UPS}


@pytest.fixture
def seeded(db):
    seed_topics()


def test_the_bank_is_ten_genres_and_a_thousand_topics_and_no_genre_is_thin(seeded):
    assert Genre.objects.filter(owner__isnull=True, mode=bank.MODE_SPEAK).count() == 10
    # A thousand sentences, and a picture bank on top of them, both counted
    # off the files: what this pins is that the seeder wrote every line and
    # no more, never how many somebody has since written.
    assert Topic.objects.count() == BANK_SIZE
    assert Topic.objects.exclude(image="").count() == PICTURES > 200
    for genre in Genre.objects.filter(owner__isnull=True, mode=bank.MODE_SPEAK):
        assert genre.topics.count() >= 40, genre.slug
    for genre in Genre.objects.filter(owner__isnull=True):
        assert genre.icon in ICONS
        assert genre.blurb


def test_every_built_in_style_reaches_every_genre_and_surprise_is_never_stored(seeded):
    """A style missing from a genre is a chip that silently does nothing.

    Every `Topic` is a prompt now, so this walks the whole table rather
    than the speak genres: a read genre has no styles at all, because
    nobody chooses how to say words they are reading verbatim, and its
    passages are not in here to be asked."""
    for genre in Genre.objects.filter(owner__isnull=True, mode=bank.MODE_SPEAK):
        assert set(genre.topics.values_list("style", flat=True)) == set(bank.STYLE_KEYS), genre.slug
    assert not Topic.objects.filter(style=bank.SURPRISE).exists()
    assert bank.SURPRISE not in bank.STYLE_KEYS


def test_a_second_run_changes_nothing_and_keeps_every_id(seeded):
    before = dict(Topic.objects.values_list("text", "id"))
    genres = dict(Genre.objects.values_list("slug", "id"))
    assert seed_topics() == (len(bank.all_genres()), BANK_SIZE + PASSAGE_COUNT)
    assert dict(Topic.objects.values_list("text", "id")) == before
    assert dict(Genre.objects.values_list("slug", "id")) == genres


def test_a_reseed_restores_what_the_seeder_owns_but_not_the_kill_switch(seeded):
    """Name, icon and order come back from the list; a dud switched off in the
    admin stays off, because that is what makes it a kill switch."""
    genre = Genre.objects.get(slug="general")
    Genre.objects.filter(pk=genre.pk).update(name="Renamed", icon="rocket", sort_order=99)
    topic = genre.topics.first()
    Topic.objects.filter(pk=topic.pk).update(is_active=False, style="story")
    seed_topics()
    genre.refresh_from_db()
    topic.refresh_from_db()
    assert (genre.name, genre.icon, genre.sort_order) == ("General", "dices", 0)
    assert topic.is_active is False
    assert topic.style == "just-talk"


def test_a_merged_genre_carries_its_topics_and_the_emptied_row_goes(seeded, monkeypatch):
    """Ten became ten from twenty this way: the file's lines move into another
    file, the rows keep their ids, and the genre that yields nothing is
    deleted rather than left in the picker looking like it works."""
    gone = Genre.objects.get(slug="tech-ai")
    moved = list(gone.topics.values_list("id", flat=True))
    monkeypatch.setattr(bank, "GENRES", tuple(g for g in bank.GENRES if g[0] != "tech-ai"))
    original = bank.load

    def merged(slug):
        topics = original(slug)
        return topics + original("tech-ai") if slug == "science" else topics

    monkeypatch.setattr(bank, "load", merged)
    seed_topics()
    assert not Genre.objects.filter(slug="tech-ai").exists()
    assert set(Topic.objects.filter(id__in=moved).values_list("genre__slug", flat=True)) == {"science"}
    assert Topic.objects.count() == BANK_SIZE


def test_a_genre_that_left_the_list_but_still_owns_topics_is_only_deactivated(seeded, monkeypatch):
    monkeypatch.setattr(bank, "GENRES", tuple(g for g in bank.GENRES if g[0] != "tech-ai"))
    seed_topics()
    genre = Genre.objects.get(slug="tech-ai")
    assert genre.is_active is False
    assert genre.topics.count() == len(bank.load("tech-ai"))


def test_a_topic_that_left_every_file_is_switched_off_not_deleted(seeded, monkeypatch):
    original = bank.load
    def dropped_one(slug):
        topics = original(slug)
        return topics[1:] if slug == "general" else topics

    monkeypatch.setattr(bank, "load", dropped_one)
    seed_topics()
    assert Topic.objects.count() == BANK_SIZE
    assert Topic.objects.filter(is_active=False).count() == 1


def test_the_seeder_never_touches_a_genre_with_an_owner(seeded):
    """Somebody's own "general" beside the built-in one: same slug, different
    owner, untouched by a reseed that rewrites everything it owns."""
    owner = factories.UserFactory()
    own = factories.GenreFactory(owner=owner, slug="general", name="My general", icon="rocket")
    mine = factories.TopicFactory(genre=own, text="Low tide", style="my own words")
    seed_topics()
    own.refresh_from_db()
    mine.refresh_from_db()
    assert (own.name, own.icon, own.is_active) == ("My general", "rocket", True)
    assert (mine.style, mine.is_active) == ("my own words", True)
    assert Topic.objects.filter(text="Low tide").count() == 2


def test_the_same_line_in_two_files_is_refused(seeded, monkeypatch):
    """Text is what the seeder upserts by, so a line in two files would migrate
    between them on every run. A topic that keeps changing genre is far
    harder to notice than an import error."""
    original = bank.load
    def duplicated(slug):
        return original("general") if slug == "tech-ai" else original(slug)

    monkeypatch.setattr(bank, "load", duplicated)
    with pytest.raises(ValueError, match="appears in both"):
        seed_topics()


def test_slugs_are_unique_within_every_genre(seeded):
    """Both tables, because `?topic=` resolves on a slug whichever kind of
    row it names."""
    for genre in Genre.objects.filter(owner__isnull=True):
        slugs = list(genre.topics.values_list("slug", flat=True))
        slugs += list(genre.tongue_twisters.values_list("slug", flat=True))
        assert len(slugs) == len(set(slugs)), genre.slug


def write_topics_file(tmp_path, items):
    (tmp_path / "picture.json").write_text(json.dumps({"genre": "Picture", "topics": items}), encoding="utf-8")


def test_a_topic_carries_a_picture_when_its_line_names_one(tmp_path, monkeypatch):
    """`image` on the row is the whole of what makes a picture topic, and
    the key was never required, so every file written before the feature
    existed still loads."""
    write_topics_file(
        tmp_path,
        [
            {"text": "A picture topic", "style": "just-talk", "image": "/topics/castle-in-mist.webp"},
            {"text": "No picture at all", "style": "just-talk"},
        ],
    )
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    topics = bank.load("picture")
    assert topics[0]["image"] == "/topics/castle-in-mist.webp"
    assert topics[1]["image"] == ""


def test_an_overlong_image_is_refused(tmp_path, monkeypatch):
    """Refused at load with the loader's own kind of error, rather than
    reaching Postgres and coming back as a raw DataError mid-seed."""
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    write_topics_file(tmp_path, [{"text": "Too long a link", "style": "just-talk", "image": "/topics/" + "a" * 500}])
    with pytest.raises(ValueError, match="overlong image"):
        bank.load("picture")


def test_a_seeded_picture_is_rewritten_from_the_file_on_every_run(seeded, monkeypatch):
    """The picture is a field the seeder owns, like the style and the order:
    swapping it in the file replaces the one on the row rather than piling
    up a second topic beside it."""
    genre = Genre.objects.get(slug="general")
    topic = Topic.objects.create(genre=genre, text="A seeded picture", slug="a-seeded-picture", style="just-talk")

    original = bank.load

    def with_picture(slug):
        topics = original(slug)
        if slug == "general":
            topics = [
                *topics,
                {
                    "text": "A seeded picture",
                    "style": "just-talk",
                    "image": "/topics/p.webp",
                    "slug": "a-seeded-picture",
                },
            ]
        return topics

    monkeypatch.setattr(bank, "load", with_picture)
    seed_topics()
    topic.refresh_from_db()
    assert topic.image == "/topics/p.webp"


def write_passages_file(tmp_path, items):
    (tmp_path / "warm.json").write_text(json.dumps({"genre": "Warm", "topics": items}), encoding="utf-8")


PASSAGE = (
    "Six strict speech specialists structured sixty sophisticated speaking scripts, subtly switching "
    "stressed syllables so that steady students stumbled slightly. Such scripts seemed simple, yet "
    "several speakers stalled, sighed, and started again. Should serious speakers surrender, or should "
    "they simply slow, steady themselves, and speak surely? Sensible speakers select shorter sections."
)


def test_a_passage_is_far_longer_than_a_prompt_may_be_and_is_not_truncated(tmp_path, monkeypatch):
    """The bug the separate table exists to stop. A prompt is capped at 200
    characters in the column and truncated to it by every writer; a passage
    is three or four times that, so while they shared a column the width
    had to be the passage's and the prompt's real rule lived nowhere."""
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    write_passages_file(tmp_path, [{"text": PASSAGE, "level": "easy", "slug": "sixty-scripts"}])
    loaded = bank.load_passages("warm")
    assert len(PASSAGE) > bank.MAX_TEXT
    assert loaded[0]["text"] == PASSAGE
    assert loaded[0]["slug"] == "sixty-scripts"
    # The other loader refuses the same file, which is what makes the two
    # loaders worth having: neither can be handed the wrong kind quietly.
    with pytest.raises(ValueError, match="characters"):
        bank.load("warm")


def test_a_passage_too_short_to_be_worth_scrolling_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    write_passages_file(tmp_path, [{"text": "She sells seashells", "level": "easy", "slug": "shells"}])
    with pytest.raises(ValueError, match="characters"):
        bank.load_passages("warm")


def test_a_passage_carries_a_level_and_a_prompt_carries_a_style_and_the_two_never_meet(tmp_path, monkeypatch):
    """Nobody chooses how to say words they are reading verbatim, so the
    four styles are meaningless on a passage. Two vocabularies on two
    columns on two tables, and nothing in one is a value in the other."""
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    write_passages_file(tmp_path, [{"text": PASSAGE, "level": "just-talk", "slug": "wrong"}])
    with pytest.raises(ValueError, match="unknown level"):
        bank.load_passages("warm")
    assert not bank.LEVEL_KEYS & bank.STYLE_KEYS


def test_a_passage_must_name_its_own_slug_and_a_prompt_may_not(tmp_path, monkeypatch):
    """A passage names its own because slugifying 700 characters gives a
    link nobody can paste. A prompt is short enough to slugify and never
    has, so the two ways of getting a slug stay one way per kind."""
    monkeypatch.setattr(bank, "TOPICS_DIR", tmp_path)
    write_passages_file(tmp_path, [{"text": PASSAGE, "level": "easy"}])
    with pytest.raises(ValueError, match="names its own slug"):
        bank.load_passages("warm")
    write_passages_file(tmp_path, [{"text": "A short prompt", "style": "just-talk", "slug": "mine"}])
    with pytest.raises(ValueError, match="names its own slug"):
        bank.load("warm")


def test_the_warm_ups_are_seeded_as_read_genres_and_the_ten_are_not(seeded):
    for slug in WARM_UP_SLUGS:
        genre = Genre.objects.get(slug=slug, owner__isnull=True)
        assert genre.mode == bank.MODE_READ
        assert genre.tongue_twisters.exists()
    assert not Genre.objects.filter(owner__isnull=True, mode=bank.MODE_READ).exclude(slug__in=WARM_UP_SLUGS).exists()
    assert Genre.objects.filter(owner__isnull=True, mode=bank.MODE_SPEAK).count() == len(bank.GENRES)


def test_a_passage_is_never_a_topic_and_a_prompt_is_never_a_tongue_twister(seeded):
    """The split itself. A warm-up's rows are in `tongue_twisters` and
    nowhere else: while they shared a table, every query that meant
    "prompts" had to remember to say so, and the ones that forgot (the
    picture route's cap among them) were wrong in ways nothing showed."""
    assert TongueTwister.objects.count() == PASSAGE_COUNT > 20
    assert not Topic.objects.filter(genre__mode=bank.MODE_READ).exists()
    assert not TongueTwister.objects.exclude(genre__mode=bank.MODE_READ).exists()
    assert set(TongueTwister.objects.values_list("level", flat=True)) == set(bank.LEVEL_KEYS)


def test_a_reseed_keeps_every_passage_id_and_the_kill_switch_holds_here_too(seeded):
    """A passage id is what a link resolves through and what the editor
    addresses, so a second run must not mint new rows; and a passage
    switched off in the admin has to stay off, exactly as a topic does."""
    before = dict(TongueTwister.objects.values_list("text", "id"))
    passage = TongueTwister.objects.first()
    filed_as = passage.level
    other = next(key for key in bank.LEVEL_KEYS if key != filed_as)
    TongueTwister.objects.filter(pk=passage.pk).update(is_active=False, level=other)
    seed_topics()
    passage.refresh_from_db()
    assert dict(TongueTwister.objects.values_list("text", "id")) == before
    assert passage.is_active is False
    # The level is the seeder's to own, like a topic's style: it comes back
    # from the file while the kill switch does not.
    assert passage.level == filed_as


def test_a_passage_that_left_the_file_is_switched_off_not_deleted(seeded, monkeypatch):
    original = bank.load_passages

    def dropped_one(slug):
        passages = original(slug)
        return passages[1:] if slug == "tongue-twisters" else passages

    monkeypatch.setattr(bank, "load_passages", dropped_one)
    seed_topics()
    assert TongueTwister.objects.count() == PASSAGE_COUNT
    assert TongueTwister.objects.filter(is_active=False).count() == 1


def test_the_same_passage_in_two_files_is_refused(seeded, monkeypatch):
    """The rule the prompts have, held separately: text is what the seeder
    upserts by, so a passage in two files would migrate between them on
    every run."""
    original = bank.load_passages
    monkeypatch.setattr(bank, "WARM_UPS", bank.WARM_UPS + (("twice", "Twice", "mic", "Again"),))
    monkeypatch.setattr(bank, "load_passages", lambda slug: original("tongue-twisters"))
    with pytest.raises(ValueError, match="appears in both"):
        seed_topics()


def test_the_seeder_never_touches_a_passage_with_an_owner(seeded):
    """The `owner IS NULL` rule, which has to hold on the new table as well
    or somebody's own passages are rewritten by a content update."""
    own = factories.GenreFactory(owner=factories.UserFactory(), slug="tongue-twisters", mode=bank.MODE_READ)
    mine = factories.TongueTwisterFactory(genre=own, level="easy")
    seed_topics()
    mine.refresh_from_db()
    assert (mine.level, mine.is_active) == ("easy", True)
    assert TongueTwister.objects.count() == PASSAGE_COUNT + 1
