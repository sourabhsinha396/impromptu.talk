"""Pins on the settings contract, so a misconfigured production host
fails at boot and a test run can never hold a real credential."""

import importlib.util

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

PRODUCTION_ENV = {"SECRET_KEY": "some-secret", "ALLOWED_HOSTS": "impromptu.example", "POSTGRES_HOST": "db"}


def load_production():
    spec = importlib.util.find_spec("impromptu.settings.production")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure(monkeypatch, **overrides):
    for name, value in {**PRODUCTION_ENV, **overrides}.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)


@pytest.mark.parametrize("missing", ["SECRET_KEY", "ALLOWED_HOSTS", "POSTGRES_HOST"])
def test_production_refuses_to_boot_without(monkeypatch, missing):
    configure(monkeypatch, **{missing: None})
    with pytest.raises(ImproperlyConfigured, match=missing):
        load_production()


def test_production_parses_comma_separated_hosts(monkeypatch):
    configure(monkeypatch, ALLOWED_HOSTS="a.example, b.example ,,c.example")
    module = load_production()
    assert module.ALLOWED_HOSTS == ["a.example", "b.example", "c.example"]


def test_production_sends_cookies_only_over_https(monkeypatch):
    configure(monkeypatch)
    module = load_production()
    assert module.SESSION_COOKIE_SECURE is True
    assert module.DEBUG is False


def test_tests_run_on_in_memory_sqlite():
    assert settings.ENVIRONMENT == "testing"
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3"
    # pytest-django rewrites ":memory:" to a shared-cache memory URI so the
    # test database survives across connections; the word is what matters.
    assert "memory" in str(settings.DATABASES["default"]["NAME"])


def test_the_app_itself_runs_on_postgres(monkeypatch):
    """The in-memory database above is the tests' and nobody else's: local
    and production both talk to the compose Postgres, and this is the pin
    that keeps a SQLite fallback from creeping back into base.py."""
    monkeypatch.delenv("POSTGRES_HOST", raising=False)
    spec = importlib.util.find_spec("impromptu.settings.local")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    database = module.DATABASES["default"]
    assert database["ENGINE"] == "django.db.backends.postgresql"
    assert database["HOST"] == "127.0.0.1"


def test_session_cookie_is_prefixed_and_lax():
    assert settings.SESSION_COOKIE_NAME == "impromptu_session"
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"


def test_rate_limit_counters_stay_in_memory_under_test():
    assert settings.RATELIMIT_STORAGE_URI == "memory://"


def test_exactly_one_proxy_hop_is_trusted():
    assert settings.RATELIMIT_TRUSTED_PROXY_HOPS == 1
