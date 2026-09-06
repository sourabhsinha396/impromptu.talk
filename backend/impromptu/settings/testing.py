"""Test settings: fast, hermetic, and holding no real credential.

Provider keys are blanked here rather than trusted to fixtures, so a
developer's .env can never leak a live key into a test run. Each key
lands here on the card that introduces it.
"""

from .base import *  # noqa: F403

ENVIRONMENT = "testing"
DEBUG = False

SECRET_KEY = "testing-not-a-secret"
ALLOWED_HOSTS = ["testserver"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Pinned to memory so a developer's .env can never point a test run at a
# real counter store.
RATELIMIT_STORAGE_URI = "memory://"
