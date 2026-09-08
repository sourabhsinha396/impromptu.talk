"""The second door: fails closed, links by google_sub then by address, and
never leaves a placeholder password on a row it creates."""

from urllib.parse import parse_qs, urlparse

from django.test import override_settings

from apps.authentication import google as google_auth
from apps.authentication.models import User
from apps.authentication.services import google_login
from tests.unit_tests import factories

START = "/api/v1/auth/google"
CALLBACK = "/api/v1/auth/google/callback"
ON = override_settings(GOOGLE_CLIENT_ID="client-id", GOOGLE_CLIENT_SECRET="client-secret")


def test_both_routes_404_when_google_is_not_configured(client):
    assert client.get(START).status_code == 404
    assert client.get(CALLBACK).status_code == 404


@ON
def test_starting_the_door_redirects_to_google_and_sets_a_nonce_cookie(client):
    response = client.get(START, {"next": "/streak"})
    assert response.status_code == 302
    assert response["Location"].startswith(google_auth.AUTHORIZE_URL)
    assert "yapholic_oauth" in response.cookies


@ON
def test_an_open_redirect_in_next_is_refused_before_it_is_ever_signed(client, monkeypatch, db):
    start = client.get(START, {"next": "//evil.example"})
    state = _state_from(start["Location"])
    monkeypatch.setattr(google_auth, "account", lambda code: {"sub": "g-6", "email": "a@example.com", "name": ""})
    response = client.get(CALLBACK, {"code": "abc", "state": state})
    assert response["Location"] == "/"


@ON
def test_the_callback_refuses_a_state_with_no_matching_cookie(client, db):
    response = client.get(CALLBACK, {"code": "abc", "state": "garbage"})
    assert response["Location"] == "/login?google_error=1"
    assert not User.objects.exists()


@ON
def test_a_new_google_identity_creates_a_row_with_no_password_and_signs_in(client, monkeypatch, db):
    start = client.get(START, {"next": "/streak"})
    state = _state_from(start["Location"])
    monkeypatch.setattr(
        google_auth, "account", lambda code: {"sub": "g-1", "email": "New@Example.com", "name": "New Person"}
    )
    response = client.get(CALLBACK, {"code": "abc", "state": state})
    assert response["Location"] == "/streak"
    user = User.objects.get(email="new@example.com")
    assert user.google_sub == "g-1"
    assert user.name == "New Person"
    assert not user.has_usable_password()
    assert client.get("/api/v1/auth/me").status_code == 200


@ON
def test_a_failed_exchange_redirects_to_login_with_the_error_flag(client, monkeypatch, db):
    start = client.get(START)
    state = _state_from(start["Location"])

    def _refuse(code):
        raise google_auth.GoogleAuthFailed("no")

    monkeypatch.setattr(google_auth, "account", _refuse)
    response = client.get(CALLBACK, {"code": "abc", "state": state})
    assert response["Location"] == "/login?google_error=1"
    assert not User.objects.exists()


def test_an_existing_address_is_linked_not_duplicated(db):
    existing = factories.UserFactory(email="speaker@example.com")
    linked = google_login(sub="g-2", email="Speaker@Example.com", name="")
    assert linked.pk == existing.pk
    linked.refresh_from_db()
    assert linked.google_sub == "g-2"
    assert linked.has_usable_password()


def test_a_google_sub_already_on_a_row_is_matched_first(db):
    existing = factories.UserFactory(email="speaker@example.com", google_sub="g-3")
    found = google_login(sub="g-3", email="someone-else@example.com", name="")
    assert found.pk == existing.pk
    assert User.objects.count() == 1


def test_a_new_account_attributes_the_referral_code_once(db):
    priya = factories.UserFactory(email="priya@example.com", affiliate_code="priya")
    user = google_login(sub="g-4", email="fresh@example.com", name="", referral_code="priya")
    assert user.referred_by == priya


def test_linking_an_existing_account_does_not_attribute_a_referral(db):
    existing = factories.UserFactory(email="speaker@example.com")
    priya = factories.UserFactory(email="priya@example.com", affiliate_code="priya")
    linked = google_login(sub="g-5", email="speaker@example.com", name="", referral_code="priya")
    assert linked.pk == existing.pk
    assert linked.referred_by is None
    assert priya.referrals.count() == 0


def _state_from(location: str) -> str:
    return parse_qs(urlparse(location).query)["state"][0]


def test_a_row_made_by_google_is_announced_and_a_linked_one_is_not(db, channel):
    """A row made by Google is as much a signup as one made by a
    password, which is why the announcement lives beside the row and not
    in the form's route. Linking an existing account is not a signup."""
    factories.UserFactory(email="speaker@example.com")
    google_login(sub="g-6", email="speaker@example.com", name="", referral_code="")
    assert channel.posted == []

    google_login(sub="g-7", email="brand@example.com", name="New Person", referral_code="")
    assert channel.headlines == ["New signup"]
    assert "via: google" in channel.posted[0]
