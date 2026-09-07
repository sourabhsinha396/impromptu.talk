"""reCAPTCHA v2 on the open forms: signup, login, forgot.

Fails open, unlike Google sign-in: an unreachable verifier degrades to
the site as it was before the captcha existed, rather than turning a
Google outage into nobody being able to make an account. Only the
transport failing opens the gate; a reachable Google answering "no" is
still refused, or the checkbox would verify nothing. Every open form is
throttled by address first, so an outage is "no captcha", never "no
defences at all".
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
TIMEOUT = 10


def enabled() -> bool:
    return bool(settings.RECAPTCHA_SITE_KEY and settings.RECAPTCHA_SECRET_KEY)


def human(token: str) -> bool:
    """Whether this submission may proceed: always, when the pair is
    unset; never, for an empty token (the box was never ticked, which
    costs no call to Google); otherwise what Google's verifier says,
    unless it could not be reached, which passes."""
    if not enabled():
        return True
    if not token:
        return False
    try:
        answer = verify(token)
    except (urllib.error.URLError, OSError, ValueError):
        logger.warning("recaptcha unreachable; passing this submission")
        return True
    return answer.get("success") is True


def verify(token: str) -> dict:
    """One HTTPS POST to Google's verifier, standard library only, so
    this costs no dependency. Raises on a dead network; tests replace
    this, as `apps/common/mail.py` does for its own `post`."""
    body = urllib.parse.urlencode({"secret": settings.RECAPTCHA_SECRET_KEY, "response": token}).encode()
    request = urllib.request.Request(VERIFY_URL, data=body, method="POST")
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
        return json.loads(response.read())
