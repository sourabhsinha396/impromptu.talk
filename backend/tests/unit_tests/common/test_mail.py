"""The Brevo backend. Nothing here reaches the provider: the outgoing
post is captured, so the request shape is pinned without a network or a
key, and the key is pinned blank under test."""

import urllib.error

from django.core.mail import EmailMultiAlternatives

from apps.common import mail
from apps.common.mail import BrevoEmailBackend
from impromptu.settings import testing


def a_message():
    message = EmailMultiAlternatives(
        subject="Hello", body="Hi", to=["a@b.com"], from_email="impromptu.talk <no-reply@impromptu.talk>"
    )
    message.attach_alternative("<p>Hi</p>", "text/html")
    return message


def test_the_suite_holds_no_key_and_sends_nothing():
    assert testing.BREVO_API_KEY == ""
    assert testing.EMAIL_BACKEND == "django.core.mail.backends.locmem.EmailBackend"


def test_sends_the_shape_brevo_expects_with_the_key_in_the_header_only(monkeypatch, settings):
    settings.BREVO_API_KEY = "key-123"
    calls = []
    monkeypatch.setattr(mail, "post", lambda url, body, headers: calls.append((url, body, headers)) or 201)
    assert BrevoEmailBackend().send_messages([a_message()]) == 1
    url, body, headers = calls[0]
    assert url.endswith("/v3/smtp/email")
    assert headers["api-key"] == "key-123"
    assert body == {
        "sender": {"email": "no-reply@impromptu.talk", "name": "impromptu.talk"},
        "to": [{"email": "a@b.com"}],
        "subject": "Hello",
        "textContent": "Hi",
        "htmlContent": "<p>Hi</p>",
    }
    assert "key-123" not in str(body)


def test_a_refusal_is_a_log_line_with_the_status_and_never_the_body(monkeypatch, settings, caplog):
    settings.BREVO_API_KEY = "key-123"

    def refuse(url, body, headers):
        raise urllib.error.HTTPError(url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr(mail, "post", refuse)
    assert BrevoEmailBackend().send_messages([a_message()]) == 0
    assert "401" in caplog.text
    assert "key-123" not in caplog.text
