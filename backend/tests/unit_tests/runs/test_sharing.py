"""The public link. Most of this is about what the page must not say: it
is the only page a stranger can open about a named person, so the
interesting assertions are the absences."""

from django.test import Client

from apps.authentication.models import User
from apps.runs import sharing
from apps.runs.streaks import FREE_DAYS
from tests.unit_tests import factories

RUNS = "/api/v1/runs"


def run(client, topic="Low tide", genre="general"):
    body = {"topic_text": topic, "genre_slug": genre, "prep_seconds": 60, "speak_seconds": 60, "spoken_seconds": 60}
    return client.post(RUNS, body, content_type="application/json")


def test_a_stranger_cannot_make_a_link(client, db):
    assert client.post(f"{RUNS}/share").status_code == 401


def test_sharing_is_off_until_asked_for_and_asking_twice_keeps_the_same_link(auth_client, user, db):
    run(auth_client)
    assert user.share_token is None
    assert auth_client.get(f"{RUNS}/history").json()["share_token"] is None
    first = auth_client.post(f"{RUNS}/share").json()["token"]
    assert len(first) >= 20
    assert auth_client.post(f"{RUNS}/share").json()["token"] == first
    assert auth_client.get(f"{RUNS}/history").json()["share_token"] == first
    assert User.objects.get(pk=user.pk).share_token == first


def test_the_page_needs_no_account_shows_the_numbers_and_never_the_email(auth_client, user, db):
    user.name = "Priya"
    user.save()
    run(auth_client)
    token = auth_client.post(f"{RUNS}/share").json()["token"]
    response = Client().get(f"{RUNS}/shared/{token}")
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["streak"], body["topics"], body["minutes"]) == ("Priya", 1, 1, 1)
    assert "example.com" not in response.content.decode()


def test_the_page_shows_eight_weeks_whatever_the_owners_plan(auth_client, db):
    """The link is the growth surface, not a tier. Pointing it at the free
    window would shrink every card ever sent the next time it moved."""
    run(auth_client)
    token = auth_client.post(f"{RUNS}/share").json()["token"]
    body = Client().get(f"{RUNS}/shared/{token}").json()
    assert body["days"] == sharing.SHARED_DAYS == 56
    assert len(body["calendar"]) == 56
    assert sharing.SHARED_DAYS > FREE_DAYS


def test_it_names_bank_topics_with_their_links_and_never_a_line_they_wrote_themselves(auth_client, db):
    genre = factories.GenreFactory(slug="general")
    factories.TopicFactory(genre=genre, text="Low tide", slug="low-tide")
    run(auth_client, "The night I told my family about the divorce")
    run(auth_client, "Low tide")
    run(auth_client, "Low tide")
    token = auth_client.post(f"{RUNS}/share").json()["token"]
    response = Client().get(f"{RUNS}/shared/{token}")
    assert response.json()["recent"] == [{"text": "Low tide", "slug": "low-tide"}]
    assert "divorce" not in response.content.decode()


def test_a_token_nobody_holds_is_a_page_that_never_existed(db):
    assert Client().get(f"{RUNS}/shared/nobody").status_code == 404
    assert sharing.owner("") is None


def test_turning_sharing_off_kills_the_link_and_sharing_again_makes_a_new_one(auth_client, user, db):
    run(auth_client)
    first = auth_client.post(f"{RUNS}/share").json()["token"]
    assert auth_client.delete(f"{RUNS}/share").status_code == 204
    user.refresh_from_db()
    assert user.share_token is None
    # The link somebody was already sent has to stop working the moment
    # the switch moves, or the switch is decoration.
    assert auth_client.get(f"{RUNS}/shared/{first}").status_code == 404
    # And sharing again is a new page, not the old one handed back to
    # everybody still holding the first link.
    assert auth_client.post(f"{RUNS}/share").json()["token"] != first


def test_turning_sharing_off_twice_is_not_an_error(auth_client, user, db):
    assert auth_client.delete(f"{RUNS}/share").status_code == 204
    assert auth_client.delete(f"{RUNS}/share").status_code == 204


def test_a_stranger_cannot_turn_a_link_off(client, db):
    assert client.delete(f"{RUNS}/share").status_code == 401
