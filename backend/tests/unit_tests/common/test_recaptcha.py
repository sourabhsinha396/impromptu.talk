"""Fails open on a dead network, never on a live refusal, and never asks
Google about a box nobody ticked."""

import urllib.error

from apps.common import recaptcha


def test_the_suite_holds_no_keys_and_the_gate_is_off():
    assert recaptcha.enabled() is False
    assert recaptcha.human("") is True
    assert recaptcha.human("anything") is True


def test_an_empty_token_is_refused_without_calling_google(settings, monkeypatch):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    monkeypatch.setattr(recaptcha, "verify", lambda token: (_ for _ in ()).throw(AssertionError("called Google")))
    assert recaptcha.human("") is False


def test_a_live_success_passes_and_a_live_refusal_does_not(settings, monkeypatch):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"
    monkeypatch.setattr(recaptcha, "verify", lambda token: {"success": True})
    assert recaptcha.human("good-token") is True
    monkeypatch.setattr(recaptcha, "verify", lambda token: {"success": False})
    assert recaptcha.human("bad-token") is False
    monkeypatch.setattr(recaptcha, "verify", lambda token: {})
    assert recaptcha.human("no-success-key") is False


def test_an_unreachable_verifier_fails_open(settings, monkeypatch):
    settings.RECAPTCHA_SITE_KEY = "site"
    settings.RECAPTCHA_SECRET_KEY = "secret"

    def _dead(token):
        raise urllib.error.URLError("no network")

    monkeypatch.setattr(recaptcha, "verify", _dead)
    assert recaptcha.human("a-token") is True


def test_verify_posts_the_secret_and_the_token(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret-123"
    captured = {}

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b'{"success": true}'

    def _urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["body"] = request.data
        return _Response()

    monkeypatch.setattr("urllib.request.urlopen", _urlopen)
    answer = recaptcha.verify("a-token")
    assert answer == {"success": True}
    assert captured["url"] == recaptcha.VERIFY_URL
    assert b"secret=secret-123" in captured["body"]
    assert b"response=a-token" in captured["body"]
