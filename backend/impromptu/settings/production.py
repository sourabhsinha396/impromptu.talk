"""Production refuses to boot misconfigured.

A missing host list, secret key or database host raises here, at
startup, instead of failing quietly at request time. All three are
pinned by tests.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

ENVIRONMENT = "production"
DEBUG = False


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"{name} must be set in production.")
    return value


SECRET_KEY = _required("SECRET_KEY")
ALLOWED_HOSTS = [host.strip() for host in _required("ALLOWED_HOSTS").split(",") if host.strip()]
# base.py defaults the database host to the compose service name. A
# production host without one named has forgotten its .env, and must say so.
_required("POSTGRES_HOST")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
