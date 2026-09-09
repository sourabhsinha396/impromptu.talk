"""Pins on the settings contract, so a misconfigured production host
fails at boot and a test run can never hold a real credential."""

import importlib.util
import sys

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

PRODUCTION_ENV = {
    "SECRET_KEY": "some-secret",
    "ALLOWED_HOSTS": "yapholic.example",
    "POSTGRES_HOST": "db",
    "DODO_API_KEY": "live-key",
    "STORAGE_BUCKET": "yapholic",
    "S3_ACCESS_KEY_ID": "some-key-id",
    "S3_SECRET_ACCESS_KEY": "some-secret-key",
    "STORAGE_PUBLIC_BASE_URL": "https://cdn.yapholic.example",
}


def load_production():
    spec = importlib.util.find_spec("yapholic.settings.production")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure(monkeypatch, **overrides):
    for name, value in {**PRODUCTION_ENV, **overrides}.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)


# The payment key is here because `is_pro` reads it before every
# billable call: a host that forgot its .env must not hand Pro to
# everybody who signs up.
@pytest.mark.parametrize(
    "missing",
    [
        "SECRET_KEY",
        "ALLOWED_HOSTS",
        "POSTGRES_HOST",
        "DODO_API_KEY",
        "STORAGE_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "STORAGE_PUBLIC_BASE_URL",
    ],
)
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
    and production both talk to the compose Postgres by its service name,
    and this is the pin that keeps a SQLite fallback from creeping back
    into base.py."""
    monkeypatch.delenv("POSTGRES_HOST", raising=False)
    spec = importlib.util.find_spec("yapholic.settings.local")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    database = module.DATABASES["default"]
    assert database["ENGINE"] == "django.db.backends.postgresql"
    assert database["HOST"] == "db"


def test_session_cookie_is_prefixed_and_lax():
    assert settings.SESSION_COOKIE_NAME == "yapholic_session"
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"


def test_rate_limit_counters_stay_in_memory_under_test():
    assert settings.RATELIMIT_STORAGE_URI == "memory://"


def test_exactly_one_proxy_hop_is_trusted():
    assert settings.RATELIMIT_TRUSTED_PROXY_HOPS == 1


def load_local():
    # local.py does `from .base import *`, and a plain re-import would
    # reuse the already-cached yapholic.settings.base module rather than
    # re-reading the env vars this test just changed.
    sys.modules.pop("yapholic.settings.base", None)
    spec = importlib.util.find_spec("yapholic.settings.local")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_base():
    # The switch itself lives in base.py, so the two tests below read it
    # there rather than through an environment module that overrides it.
    sys.modules.pop("yapholic.settings.base", None)
    spec = importlib.util.find_spec("yapholic.settings.base")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_static_files_serve_off_disk_with_no_bucket_configured(monkeypatch):
    monkeypatch.delenv("STORAGE_BUCKET", raising=False)
    module = load_base()
    assert module.STATIC_URL == "static/"
    assert module.STORAGES["staticfiles"]["BACKEND"] == "django.contrib.staticfiles.storage.StaticFilesStorage"


def test_static_files_serve_from_the_cdn_once_a_bucket_is_set(monkeypatch):
    monkeypatch.setenv("STORAGE_BUCKET", "yapholic")
    monkeypatch.setenv("STORAGE_PUBLIC_BASE_URL", "https://cdn.yapholic.example")
    module = load_base()
    assert module.STATIC_URL == "https://cdn.yapholic.example/static/"
    assert module.STORAGES["staticfiles"]["BACKEND"] == "storages.backends.s3.S3Storage"


def test_local_serves_static_off_disk_even_with_a_bucket_in_the_env(monkeypatch):
    """The failure this pins: a developer's .env carries the deploy host's
    bucket so one file holds every address, base.py's switch flips on that
    variable alone whichever settings module is loaded, and runserver's
    staticfiles handler only intercepts a relative STATIC_URL. With an
    absolute one on another host it never sees the request, so the local
    admin came back unstyled with nothing in the log to say why."""
    monkeypatch.setenv("STORAGE_BUCKET", "yapholic")
    monkeypatch.setenv("STORAGE_PUBLIC_BASE_URL", "https://cdn.yapholic.example")
    module = load_local()
    assert module.STATIC_URL == "static/"
    assert module.STORAGES["staticfiles"]["BACKEND"] == "django.contrib.staticfiles.storage.StaticFilesStorage"
