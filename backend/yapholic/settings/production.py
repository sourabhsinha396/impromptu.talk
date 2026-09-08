"""Production refuses to boot misconfigured.

A missing host list, secret key, database host or payment key raises
here, at startup, instead of failing quietly at request time. All four
are pinned by tests.
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

# The payment provider, because `is_pro` is read before every billable
# call and a missing key must never be the thing that decides who is
# entitled to one (owner's call). Without this a production host that
# forgot its .env would sell nothing and hand Pro to everybody who signed
# up, which is the failure that arrives as a bill rather than as an error.
DODO_API_KEY = _required("DODO_API_KEY")

# Static files (the admin's own CSS included) are served from S3-compatible
# storage behind a CDN. Without these base.py's own switch falls back to
# serving them off this process's disk, which is how the admin ends up
# with no styling in production; failing at boot is the same call as the
# payment key above.
_required("STORAGE_BUCKET")
_required("S3_ACCESS_KEY_ID")
_required("S3_SECRET_ACCESS_KEY")
_required("STORAGE_PUBLIC_BASE_URL")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
