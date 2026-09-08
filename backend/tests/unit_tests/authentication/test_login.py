"""The sign-in door: one sentence for every wrong pair, a session for
the right one, and a throttle that refuses the right password too."""

from django.conf import settings

from apps.authentication.models import User
from apps.common import recaptcha
from apps.common.devices import DEVICE_COOKIE
from tests.unit_tests import factories

LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
RUNS = "/api/v1/runs"
RUN = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60, "spoken_seconds": 60}
WRONG = {"detail": "That email and password do not match."}


def login(client, email="speaker@example.com", password=factories.PASSWORD):
    return client.post(LOGIN, {"email": email, "password": password}, content_type="application/json")


def test_the_right_password_opens_a_session(client, user):
    response = login(client, email=" Speaker@Example.com ")
    assert response.status_code == 200
    assert response.json()["email"] == "speaker@example.com"
    assert settings.SESSION_COOKIE_NAME in client.cookies
    assert client.get(ME).status_code == 200


def test_a_wrong_password_and_an_unknown_address_read_the_same(client, user):
    wrong = login(client, password="not-the-password")
    unknown = login(client, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json() == WRONG
    assert settings.SESSION_COOKIE_NAME not in client.cookies


def test_a_row_without_a_password_refuses_every_password(client, db):
    User.objects.create_user("google-only@example.com", None)
    assert login(client, email="google-only@example.com", password="").status_code == 400
    assert login(client, email="google-only@example.com", password="anything at all").json() == WRONG


def test_signing_in_claims_the_devices_runs_and_keeps_the_device(client, user):
    client.post(RUNS, RUN, content_type="application/json")
    device = client.cookies[DEVICE_COOKIE].value
    login(client)
    assert user.runs.count() == 1
    assert client.cookies[DEVICE_COOKIE].value == device


def test_the_sixth_try_on_one_account_is_refused_even_with_the_right_password(client, user):
    for _ in range(5):
        assert login(client, password="not-the-password").status_code == 400
    response = login(client)
    assert response.status_code == 429
    assert int(response["Retry-After"]) >= 1
    assert settings.SESSION_COOKIE_NAME not in client.cookies


def test_an_untipped_captcha_refuses_the_login(client, user, settings):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    response = login(client)
    assert response.status_code == 400
    assert response.json() == {"detail": "Confirm you're not a robot."}
    assert settings.SESSION_COOKIE_NAME not in client.cookies


def test_a_long_captcha_token_reaches_the_verifier_rather_than_a_422(client, user, settings, monkeypatch):
    """The live site refused every login with a bare 422 for a fortnight's
    worth of an afternoon: the schema capped the token at 2000 characters
    and Google had grown past it. Nobody types this field, so the length
    is Google's to decide and ours only to carry."""
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    seen = {}

    def _verify(token):
        seen["length"] = len(token)
        return {"success": True}

    monkeypatch.setattr(recaptcha, "verify", _verify)
    token = "t" * 4000
    response = client.post(
        LOGIN,
        {"email": "speaker@example.com", "password": factories.PASSWORD, "recaptcha_token": token},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert seen["length"] == 4000


def test_the_account_window_is_the_typed_address_not_the_caller(client, user):
    """Five tries on one account do not lock a neighbour out of theirs."""
    for _ in range(5):
        login(client, password="not-the-password")
    factories.UserFactory(email="neighbour@example.com")
    assert login(client, email="neighbour@example.com").status_code == 200
