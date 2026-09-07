"""The signup door. A refusal is one sentence and nothing is written;
a success is a row, a session and the device's runs claimed."""

from django.conf import settings

from apps.authentication.models import User
from apps.common.referrals import REFERRAL_COOKIE
from tests.unit_tests import factories

SIGNUP = "/api/v1/auth/signup"
ME = "/api/v1/auth/me"
RUNS = "/api/v1/runs"
RUN = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60, "spoken_seconds": 60}


def signup(client, **over):
    body = {"email": "Speaker@Example.COM", "password": "correct horse battery", "name": "  Ada   Grace "}
    body.update(over)
    return client.post(SIGNUP, body, content_type="application/json")


def test_creates_the_account_lowercased_and_tidied_and_signs_it_in(client, db):
    response = signup(client)
    assert response.status_code == 201
    body = {"email": "speaker@example.com", "name": "Ada Grace", "is_superuser": False, "accent": "", "is_pro": True}
    assert response.json() == body
    assert settings.SESSION_COOKIE_NAME in client.cookies
    assert client.get(ME).status_code == 200
    user = User.objects.get()
    assert user.check_password("correct horse battery")
    assert "correct horse battery" not in user.password


def test_a_name_is_optional(client, db):
    assert signup(client, name="").status_code == 201
    assert User.objects.get().name == ""


def test_each_refusal_is_one_sentence_and_writes_nothing(client, db):
    factories.UserFactory(email="taken@example.com")
    cases = [
        ({"password": "short"}, "Use at least 8 characters."),
        ({"email": "not-an-email"}, "That does not look like an email address."),
        ({"email": "taken@example.com"}, "That email already has an account."),
    ]
    for over, sentence in cases:
        response = signup(client, **over)
        assert response.status_code == 400, over
        assert response.json() == {"detail": sentence}
    assert User.objects.count() == 1
    assert settings.SESSION_COOKIE_NAME not in client.cookies


def test_a_value_no_person_could_have_typed_is_refused_at_the_edge(client, db):
    assert signup(client, email="x" * 3000 + "@example.com").status_code == 422
    assert not User.objects.exists()


def test_nothing_in_the_post_can_raise_the_operator_flags(client, db):
    signup(client, is_superuser=True, is_staff=True)
    user = User.objects.get()
    assert not user.is_superuser
    assert not user.is_staff


def test_the_devices_anonymous_runs_become_the_accounts(client, db):
    client.post(RUNS, RUN, content_type="application/json")
    client.post(RUNS, RUN, content_type="application/json")
    signup(client)
    assert User.objects.get().runs.count() == 2
    assert client.post(RUNS, RUN, content_type="application/json").json()["topics"] == 3


def test_the_referral_cookie_names_who_sent_them_once_and_a_dead_code_is_ignored(client, db):
    priya = factories.UserFactory(email="priya@example.com", affiliate_code="priya")
    client.cookies[REFERRAL_COOKIE] = "nobody"
    signup(client, email="first@example.com")
    assert User.objects.get(email="first@example.com").referred_by is None

    client.cookies[REFERRAL_COOKIE] = "priya"
    signup(client, email="second@example.com")
    second = User.objects.get(email="second@example.com")
    assert second.referred_by == priya

    # Frozen: a later click on somebody else's link changes nothing.
    factories.UserFactory(email="raj@example.com", affiliate_code="raj")
    from apps.authentication.services import attribute_referral

    attribute_referral(second, "raj")
    second.refresh_from_db()
    assert second.referred_by == priya


def test_an_untipped_captcha_refuses_the_signup_and_writes_nothing(client, db, settings):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    response = signup(client)
    assert response.status_code == 400
    assert response.json() == {"detail": "Confirm you're not a robot."}
    assert not User.objects.exists()


def test_the_sixth_signup_from_one_address_in_an_hour_is_refused(client, db):
    for n in range(5):
        assert signup(client, email=f"speaker{n}@example.com").status_code == 201
        client.cookies.clear()
    response = signup(client, email="speaker6@example.com")
    assert response.status_code == 429
    assert int(response["Retry-After"]) >= 1
    assert not User.objects.filter(email="speaker6@example.com").exists()


def test_a_new_account_is_announced_and_a_refused_one_is_not(client, db, channel):
    """The row is committed by the time this fires, and `slack.notify`
    never raises, so an account is never lost to a webhook having a bad
    minute. A sign-in is not a signup and neither is a refusal."""
    assert signup(client).status_code == 201
    assert channel.headlines == ["New signup"]
    assert "who: speaker@example.com" in channel.posted[0]
    assert "via: email" in channel.posted[0]

    assert signup(client).status_code == 400
    client.post("/api/v1/auth/login", {"email": "speaker@example.com", "password": "correct horse battery"},
                content_type="application/json")
    assert channel.headlines == ["New signup"]
