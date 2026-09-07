"""Sending mail: Brevo's API when a key is set, Django's console backend
when it is not, both behind Django's own EMAIL_BACKEND so nothing in the
apps knows which.

Every message is a pair of Django templates under `templates/mail/`, html
and txt, because a link that only exists in a part the client will not
render is a support ticket. `send` never raises: every caller sits after
a committed row (a reset asked for, a payment settled), and a provider
having a day must not turn that into a 500. A failure is a log line.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import sanitize_address
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT = 10


def send(template: str, *, to: str, subject: str, **context) -> bool:
    """Render `mail/<template>.html` and `.txt` and send them as one
    message. True when the backend accepted it."""
    context = {"site_name": settings.SITE_NAME, **context}
    text = render_to_string(f"mail/{template}.txt", context)
    html = render_to_string(f"mail/{template}.html", context)
    message = EmailMultiAlternatives(subject=subject, body=text, to=[to])
    message.attach_alternative(html, "text/html")
    try:
        return message.send() == 1
    except Exception:
        logger.exception("mail %r to %s did not send", template, to)
        return False


def post(url: str, body: dict, headers: dict) -> int:
    """One HTTPS POST with the standard library, so mail costs no
    dependency. Returns the status code; raises on a refusal or a dead
    network, which the backend turns into a log line. Tests replace this."""
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
        return response.status


class BrevoEmailBackend(BaseEmailBackend):
    """Brevo's transactional endpoint, one call per message. The key
    travels in a header and never in a body or a log line: it is the
    credential and the account at once."""

    def send_messages(self, email_messages) -> int:
        sent = 0
        for message in email_messages:
            if self._send(message):
                sent += 1
        return sent

    def _send(self, message) -> bool:
        html = next((content for content, kind in message.alternatives if kind == "text/html"), "")
        name, address = _sender(message.from_email or settings.DEFAULT_FROM_EMAIL)
        body = {
            "sender": {"email": address, **({"name": name} if name else {})},
            "to": [{"email": sanitize_address(to, message.encoding)} for to in message.to],
            "subject": message.subject,
            "textContent": message.body,
        }
        if html:
            body["htmlContent"] = html
        try:
            post(BREVO_URL, body, {"api-key": settings.BREVO_API_KEY, "accept": "application/json"})
        except (urllib.error.URLError, OSError) as exc:
            if not self.fail_silently:
                # The status code, not the exception text, which for an
                # HTTPError can carry the response body.
                logger.error("brevo refused mail to %s: %s", message.to, getattr(exc, "code", exc.__class__.__name__))
            return False
        return True


def _sender(value: str) -> tuple[str, str]:
    """ "Name <address>" into its two halves; a bare address has no name."""
    if "<" in value and value.endswith(">"):
        name, _, rest = value.partition("<")
        return name.strip().strip('"'), rest[:-1].strip()
    return "", value.strip()
