"""The bank endpoint: the whole built-in bank, public and cacheable, and
nothing that is switched off or belongs to somebody."""

from pathlib import Path

import pytest

from apps.topics import bank
from apps.topics.models import Genre, Topic
from apps.topics.services import seed_topics
from tests.unit_tests import factories

BANK = "/api/v1/topics/bank"


@pytest.fixture
def seeded(db):
    seed_topics()


def test_the_whole_bank_arrives_in_one_cacheable_answer(seeded, client):
    response = client.get(BANK)
    assert response.status_code == 200
    assert response["Cache-Control"] == "public, max-age=3600"
    body = response.json()
    assert [g["slug"] for g in body["genres"]][:3] == ["general", "relationships", "career"]
    assert len(body["topics"]) == sum(len(bank.load(slug) or ()) for slug, *_ in bank.GENRES)
    # A topic with no picture carries no `image` key at all: home ships the
    # whole bank inline, and an empty key on every row is 34KB of JSON the
    # browser parses on every visit for the sake of the few hundred that do.
    assert body["topics"][0] == {"text": "Low tide", "genre": "general", "style": "just-talk", "slug": "low-tide"}
    assert [s["key"] for s in body["styles"]] == ["surprise", "just-talk", "hot-take", "explain", "story"]
    # Every genre listed carries topics here except the warm-ups, whose
    # passages are fetched when one is picked.
    speaking = {g["slug"] for g in body["genres"] if not g.get("mode")}
    assert {t["genre"] for t in body["topics"]} == speaking


def test_the_picture_bank_is_whole_and_every_path_names_a_file_that_exists(seeded, client):
    """The picture is the whole prompt, so a path that 404s is a round with
    nothing to talk about, which no amount of frontend care can recover
    from. Two hundred and twenty is an inventory and not a count somebody
    might drift past: each one was looked at before its line was written
    (docs/DECISIONS.md, 2026-09-09), so it moves only on purpose.

    Not every genre carries one. Deep research ships with none, because a
    caption written without seeing the photograph is a caption that does
    not fit it, and `pool` covers a genre with none by borrowing from the
    bank rather than handing back a sentence. What must hold is that the
    bank as a whole is never empty, or that fallback has nothing to reach
    for and picture mode silently stops being a mode.

    Counted off the files with a floor under it rather than pinned to a
    literal. The literal was 220 and went stale the week the picture bank
    grew, which failed six tests that were not about pictures at all; what
    has to hold is that every picture in a file reaches the endpoint and
    every path resolves, and neither of those is a number somebody types."""
    frontend = Path(__file__).resolve().parents[3].parent / "frontend" / "public"
    body = client.get(BANK).json()
    pictures = [t for t in body["topics"] if t.get("image")]
    in_files = sum(1 for slug, *_ in bank.GENRES for t in bank.load(slug) or () if t["image"])
    assert len(pictures) == in_files > 200
    assert {t["genre"] for t in pictures} <= {g["slug"] for g in body["genres"]}
    for topic in pictures:
        assert topic["image"].startswith("/topics/"), topic["image"]
        assert (frontend / topic["image"].lstrip("/")).exists(), topic["image"]


def test_what_is_switched_off_or_owned_by_somebody_stays_out(seeded, client):
    """A dud switched off in the admin, a genre taken off the list, and a
    person's own genre are all invisible here: the public bank is the
    public bank."""
    Topic.objects.filter(text="Low tide").update(is_active=False)
    Genre.objects.filter(slug="tech-ai").update(is_active=False)
    own = factories.GenreFactory(owner=factories.UserFactory(), slug="mine", name="Mine")
    factories.TopicFactory(genre=own, text="Only mine")
    body = client.get(BANK).json()
    texts = {t["text"] for t in body["topics"]}
    assert "Low tide" not in texts
    assert "Only mine" not in texts
    assert "mine" not in {g["slug"] for g in body["genres"]}
    assert "tech-ai" not in {g["slug"] for g in body["genres"]}
    assert not any(t["genre"] == "tech-ai" for t in body["topics"])


def test_a_warm_up_is_listed_in_the_picker_but_its_passages_are_not_shipped_inline(seeded, client):
    """The reason the two are split. A passage is 100 to 120 words, and home
    ships the whole bank inline so a respin costs no round trip; putting
    every passage in that answer would charge every visitor for a genre
    most of them never open. The genre still has to be listed, or there is
    nothing in the picker to press."""
    body = client.get(BANK).json()
    warm_ups = [g for g in body["genres"] if g.get("mode") == bank.MODE_READ]
    assert [g["slug"] for g in warm_ups] == [slug for slug, *_ in bank.WARM_UPS]
    assert not [t for t in body["topics"] if t["genre"] == "tongue-twisters"]


def test_a_warm_up_hands_over_its_passages_whole_and_counts_their_words(seeded, client):
    """Words, because the speed the scroller runs at is in words a minute,
    so how long a passage takes is arithmetic the browser does rather than
    a number anybody stores."""
    response = client.get(f"{BANK}/tongue-twisters")
    assert response.status_code == 200
    assert response["Cache-Control"] == "public, max-age=3600"
    body = response.json()
    assert body["name"] == "Tongue twisters"
    passages = body["passages"]
    assert len(passages) == len(bank.load("tongue-twisters", bank.MODE_READ))
    assert {p["style"] for p in passages} == set(bank.READ_STYLE_KEYS)
    for passage in passages:
        assert passage["words"] == len(passage["text"].split())
        # Long enough to be worth scrolling: 40 seconds at 150 words a
        # minute is 100 words, and that is the floor the feature exists for.
        assert passage["words"] >= 90, passage["slug"]
        assert passage["slug"] and " " not in passage["slug"]


def test_a_speak_genre_has_no_passages_endpoint(seeded, client):
    """Two ways to ask for the same rows is two things to keep agreeing."""
    assert client.get(f"{BANK}/general").status_code == 404
    assert client.get(f"{BANK}/not-a-genre").status_code == 404
