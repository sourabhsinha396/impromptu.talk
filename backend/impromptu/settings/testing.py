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
# Blank, so no test can reach the provider whatever a developer's .env
# holds; the in-memory backend is what the suite reads mail off.
BREVO_API_KEY = ""
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Pinned to memory so a developer's .env can never point a test run at a
# real counter store.
RATELIMIT_STORAGE_URI = "memory://"

# Blank, so Google sign-in is off and its routes 404 whatever a
# developer's .env holds.
GOOGLE_CLIENT_ID = ""
GOOGLE_CLIENT_SECRET = ""

# Blank, so no test needs a captcha token whatever a developer's .env
# holds; `recaptcha.human()` passes everything when unset.
RECAPTCHA_SITE_KEY = ""
RECAPTCHA_SECRET_KEY = ""

# Blank, so no test can reach the provider whatever a developer's .env
# holds. A test that wants the shop open sets these itself; with them
# empty nothing is for sale and every feature is free, which is the state
# the site ships in until the first product id exists.
DODO_API_KEY = ""
DODO_PRODUCTS = {"monthly": "", "annual": "", "pass": "", "lifetime": ""}
DODO_BASE_URL = "https://test.invalid"

# Blank, so no test can post whatever a developer's .env holds. This is
# the one key that costs nothing to reach: a run that found a real webhook
# would pass while filling the channel somebody watches for real signups
# with several hundred invented ones. `tests/conftest.py` records what was
# sent on top of this, and `test_slack.py` asserts both halves.
SLACK_WEBHOOK_URL = ""

# Blank, so no test can spend whatever a developer's .env holds; every
# test that generates runs against `openrouter.RecordingGateway`, and a
# test that wants the feature on sets the key itself.
OPENROUTER_API_KEY = ""
OPENROUTER_BASE_URL = "https://openrouter.invalid"
