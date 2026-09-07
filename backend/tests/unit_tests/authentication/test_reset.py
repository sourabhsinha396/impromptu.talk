"""Forgotten passwords. The link is short-lived, dies the moment it is
used, and the asking route never says whether an address has an account."""

import re

from django.conf import settings
from django.core import mail
from django.test import Client

from apps.authentication.models import User
from tests.unit_tests import factories

FORGOT = "/api/v1/auth/forgot"
RESET = "/api/v1/auth/reset"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
NEW = "a brand new password"
DEAD = {"detail": "That link has expired or has already been used."}


def ask(client, email="speaker@example.com"):
    return client.post(FORGOT, {"email": email}, content_type="application/json")


def token_from_mail() -> str:
    """The token as the visitor would follow it out of the mail."""
    return re.search(r"/reset/(\S+)", mail.outbox[-1].body).group(1)


def reset(client, token, password=NEW):
    return client.post(RESET, {"token": token, "password": password}, content_type="application/json")


def test_a_known_address_gets_one_mail_with_both_parts_and_an_unknown_one_gets_the_same_answer(client, user):
    known = ask(client)
    unknown = ask(client, "nobody@example.com")
    assert known.status_code == unknown.status_code == 204
    assert [m.to for m in mail.outbox] == [["speaker@example.com"]]
    sent = mail.outbox[0]
    assert sent.from_email == settings.DEFAULT_FROM_EMAIL
    assert f"{settings.FRONTEND_ORIGIN}/reset/" in sent.body
    html, kind = sent.alternatives[0]
    assert kind == "text/html" and "/reset/" in html
    assert "<" not in sent.body.split("/reset/")[0]


def test_the_link_sets_the_password_signs_in_here_and_ends_every_other_session(client, user):
    other = Client()
    other.force_login(user)
    ask(client)
    response = reset(client, token_from_mail())
    assert response.status_code == 200
    assert client.get(ME).status_code == 200
    assert other.get(ME).status_code == 401
    user.refresh_from_db()
    assert user.check_password(NEW) and not user.check_password(factories.PASSWORD)


def test_a_used_link_is_dead_and_a_made_up_one_never_lived(client, user):
    ask(client)
    token = token_from_mail()
    reset(client, token)
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 400
    assert reset(client, token, "another password").json() == DEAD
    assert client.get("/api/v1/auth/reset/not-a-real-token").json() == DEAD
    assert reset(Client(), "Mg.not-a-token").status_code == 400


def test_a_short_password_is_refused_with_the_sentence_and_the_link_stays_live(client, user):
    ask(client)
    token = token_from_mail()
    assert reset(client, token, "short").json() == {"detail": "Use at least 8 characters."}
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 204


def test_an_expired_link_is_refused(client, user, settings):
    ask(client)
    token = token_from_mail()
    # Django compares the token's age against the timeout; below zero,
    # a link minted this second is already too old.
    settings.PASSWORD_RESET_TIMEOUT = -1
    assert client.get(f"/api/v1/auth/reset/{token}").status_code == 400


def test_a_google_only_row_gains_a_password_by_mail(client, db):
    User.objects.create_user("google-only@example.com", None)
    ask(client, "google-only@example.com")
    assert reset(client, token_from_mail()).status_code == 200
    client.post("/api/v1/auth/logout")
    signed_in = client.post(
        LOGIN, {"email": "google-only@example.com", "password": NEW}, content_type="application/json"
    )
    assert signed_in.status_code == 200


def test_an_untipped_captcha_refuses_the_ask_and_sends_no_mail(client, user, settings):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    response = ask(client)
    assert response.status_code == 400
    assert response.json() == {"detail": "Confirm you're not a robot."}
    assert mail.outbox == []


def test_the_fourth_ask_for_one_address_in_an_hour_is_refused(client, user):
    for _ in range(3):
        assert ask(client).status_code == 204
    response = ask(client)
    assert response.status_code == 429
    assert len(mail.outbox) == 3


def test_a_provider_having_a_day_is_a_log_line_not_a_500(client, user, monkeypatch, caplog):
    def broken(message):
        raise OSError("dns")

    monkeypatch.setattr("django.core.mail.EmailMultiAlternatives.send", lambda self, fail_silently=False: broken(self))
    assert ask(client).status_code == 204
    assert "did not send" in caplog.text
