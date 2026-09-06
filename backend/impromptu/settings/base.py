"""Settings shared by every environment.

Product policy lives in code; env holds only secrets and addresses.
Each environment module does `from .base import *` and overrides the
little it must.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-key")

DEBUG = False
ALLOWED_HOSTS: list[str] = []

ENVIRONMENT = "base"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.common",
    "apps.authentication",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.devices.DeviceCookieMiddleware",
]

ROOT_URLCONF = "impromptu.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "impromptu.wsgi.application"

# Postgres everywhere the app runs, from `docker compose up` in backend/;
# the only SQLite in the project is the in-memory one tests run on. The
# host defaults to the compose network name, and nothing is published on
# the host, so this stack never collides with a neighbouring project's
# Postgres on 5432; production still requires the host to be named (see
# production.py).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "impromptu"),
        "USER": os.environ.get("POSTGRES_USER", "impromptu"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "impromptu"),
        "HOST": os.environ.get("POSTGRES_HOST") or "db",
        "PORT": os.environ.get("POSTGRES_PORT") or "5432",
    }
}

AUTH_USER_MODEL = "authentication.User"

# Eight characters and nothing else, which is what v0 asked. The
# similarity, common-password and numeric validators are the kind of
# refusal a form has to explain in a sentence, and none earned one.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

# Prefixed so localhost ports do not share sessions with the neighbouring
# apps (algoholic on 3007/8007, v0 on 8078).
SESSION_COOKIE_NAME = "impromptu_session"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
SESSION_COOKIE_SAMESITE = "Lax"

# Where rate limit counters live. An address, so env: memory serves one
# process, and anything with more than one needs the shared store compose
# provides. `or` because dotenv renders a blank line as "", which must
# still mean memory.
RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI") or "memory://"

# How many proxies stand between the client and this process. The
# frontend rewrite is the one trusted hop; X-Forwarded-For entries the
# client sent itself must never get to pick the bucket. Topology, not an
# address, so it is code.
RATELIMIT_TRUSTED_PROXY_HOPS = 1

# Where the frontend answers: mail links and checkout returns are built
# from it. An address, so env; the default is the dev server.
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN") or "http://localhost:3008"

# Console here keeps every non-production environment safe by default.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
