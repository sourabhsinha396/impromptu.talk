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
    "apps.topics",
    "apps.runs",
    "apps.payments",
    "apps.affiliates",
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
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN") or "http://localhost:3009"

# What the site calls itself in a mail. Copy, so code.
SITE_NAME = "impromptu.talk"

# Mail goes through Brevo when a key is set and to the console when it is
# not, so a checkout with no key prints the message and a laptop with one
# can prove the provider works. The key is the whole gate; testing blanks
# it and pins the in-memory backend. The from address is an address, so
# env; the name beside it is the site's.
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "").strip()
EMAIL_BACKEND = (
    "apps.common.mail.BrevoEmailBackend" if BREVO_API_KEY else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = f"{SITE_NAME} <{os.environ.get('MAIL_FROM_ADDRESS') or 'no-reply@impromptu.talk'}>"

# Google sign-in. Both empty is the supported off state, not a
# misconfiguration: `apps/authentication/google.py` 404s its own routes
# rather than raising here, so a host that never sets these boots fine and
# a stranger typing the URL by hand gets the same 404 as any other route
# that does not exist.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()

# reCAPTCHA v2, on the open forms (signup, login, forgot). Fails open,
# unlike Google above: an unreachable verifier degrades to the site as it
# was before the captcha existed, rather than refusing every signup
# because Google is having a day. Both empty is the supported off state;
# `apps/common/recaptcha.py` reads the pair together.
RECAPTCHA_SITE_KEY = os.environ.get("RECAPTCHA_SITE_KEY", "").strip()
RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY", "").strip()

# The payment provider. The key is the whole switch: with none, nothing
# is for sale, Pro is not linked, and no feature is gated, because gating
# on a purchase nobody can make is a lock on a door with no key cut for
# it. Each plan also needs its own dashboard product id, and a missing one
# switches that plan off on its own. Prices are not here: they are product
# policy and live in `apps/payments/plans.py`, reviewed like code.
DODO_API_KEY = os.environ.get("DODO_API_KEY", "").strip()
# Their test host by default: a host that forgot this variable talks to
# the sandbox rather than to somebody's card.
DODO_BASE_URL = os.environ.get("DODO_BASE_URL", "").strip() or "https://test.dodopayments.com"
DODO_PRODUCTS = {
    "monthly": os.environ.get("DODO_PRODUCT_MONTHLY", "").strip(),
    "annual": os.environ.get("DODO_PRODUCT_ANNUAL", "").strip(),
    "pass": os.environ.get("DODO_PRODUCT_PASS", "").strip(),
    "lifetime": os.environ.get("DODO_PRODUCT_LIFETIME", "").strip(),
}

# Generating topics from a sentence (card 30). Empty is the supported off
# state: the pane is not drawn, the route 404s, and nothing on the editor
# mentions it. The model is a setting rather than code because it is an
# address at the provider's end, like a product id; how many generations
# an account gets is product policy and lives in `apps/topics/generate.py`.
# Spend is capped twice: by that allowance, and by a hard limit set on the
# key in the provider's dashboard, which is the one that holds if the
# first has a bug.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "").strip() or "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "").strip() or "google/gemini-2.5-flash-lite"

# A Slack incoming webhook, for the handful of events somebody would act
# on today; `apps/common/slack.py` holds the list and the test a seventh
# has to pass. Empty is the supported off state and logs the line instead
# of posting, which is the sensible default for a checkout that has never
# opened a Slack workspace. The URL is the credential and the channel at
# once, so it never reaches a log.
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()

# A reset link lives an hour. Django's token needs no table: it is signed
# over the password hash and the last sign-in, so it dies the moment
# either changes, which is what a reset does.
PASSWORD_RESET_TIMEOUT = 60 * 60

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
