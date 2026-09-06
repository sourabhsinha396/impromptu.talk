"""The bank endpoint: the whole built-in bank, public and cacheable, and
nothing that is switched off or belongs to somebody."""

import pytest

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
    assert [g["slug"] for g in body["genres"]][:3] == ["general", "everyday-life", "relationships"]
    assert len(body["topics"]) == 1000
    assert body["topics"][0] == {"text": "Low tide", "genre": "general", "style": "just-talk", "slug": "low-tide"}
    assert [s["key"] for s in body["styles"]] == ["surprise", "just-talk", "hot-take", "explain", "story"]
    assert {t["genre"] for t in body["topics"]} == {g["slug"] for g in body["genres"]}


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
