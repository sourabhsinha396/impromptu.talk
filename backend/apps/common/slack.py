"""Telling a channel the handful of things somebody would act on today.

One incoming webhook and nothing else: no bot token, no scopes, no app to
install. The URL is the credential and the channel at once, which is why
there is no channel setting here - pointing this somewhere else is editing
one environment variable.

What earns a line is one question: would somebody do something about it
today? A payment that failed is a person who tried to pay and could not,
and somebody can write to them. A finished round is not, and neither is an
account spending the last of its generations, which is the allowance
working as designed. A channel that reports normal operation gets muted,
and a muted channel does not deliver the cancellation either.

`notify` never raises. Every caller sits after a committed row - an
account exists, money has moved - and none of that can be undone by a
webhook having a bad minute, which is the promise `apps/common/mail.py`
already makes about the receipt.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

# Shorter than the mailer's. Nobody is waiting to read this, but a worker
# is holding a request open for it: every caller has already finished the
# work the visitor came for.
TIMEOUT = 5


def enabled() -> bool:
    return bool(settings.SLACK_WEBHOOK_URL)


def notify(headline: str, **fields) -> bool:
    """Post one line to the channel. Never raises, whatever goes wrong.

    `fields` render in the order given, so name the thing being reported
    first. An empty value is dropped rather than printed blank, which is
    what lets one call site cover a subscription and a one-time payment
    without two message formats.

    Anything that is not production says so in the message. That is what
    makes the key the whole gate here, where analytics are additionally
    production-only: a laptop can prove the webhook works, and the line it
    posts cannot be mistaken for a real signup somebody scrolled past.
    """
    pairs = [(name.replace("_", " "), str(value)) for name, value in fields.items() if value not in (None, "")]
    if settings.ENVIRONMENT != "production":
        pairs.append(("env", settings.ENVIRONMENT))
    text = message(headline, pairs)
    if not enabled():
        # No webhook is not an error: the events still happen and are
        # still worth finding afterwards, and there is nowhere to send
        # them. Unlike the console mail backend this prints nothing a
        # developer has to read to finish a flow.
        logger.info("slack (no webhook): %s", text.replace("\n", " - "))
        return True
    try:
        post(settings.SLACK_WEBHOOK_URL, {"text": text})
    except urllib.error.HTTPError as exc:
        # The status, never the exception. Its message is built out of the
        # URL it called, and that URL is the credential: printing it
        # verbatim would put the whole webhook in the log somebody pastes
        # into a bug report.
        logger.warning("slack refused %r with HTTP %s", headline, exc.code)
        return False
    except Exception as exc:
        # Bare on purpose rather than by oversight. A caller of this has
        # committed a row and moved money, and there is no failure in here
        # - a malformed URL, a dead DNS, a bug in this module - worth
        # turning that into a 500. The class, not the message, for the
        # same reason as above.
        logger.warning("slack notification %r did not send: %s", headline, type(exc).__name__)
        return False
    return True


def message(headline: str, pairs: list[tuple[str, str]]) -> str:
    """Slack mrkdwn: a bold headline with the details under it.

    `text` rather than `blocks`, which is a JSON document with a schema
    that can be got wrong, and getting it wrong is answered with a 400
    nobody is watching for. This renders in every client, in the
    notification on a phone, and in the log line the fallback writes.
    """
    detail = "  -  ".join(f"{name}: {value}" for name, value in pairs)
    return f"*{headline}*\n{detail}" if detail else f"*{headline}*"


def post(url: str, body: dict) -> int:
    """One HTTPS POST with the standard library, so a channel costs no
    dependency. Raises on a refusal or a dead network, which `notify`
    turns into a log line. Tests replace this, as they do the mailer's."""
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
        return response.status
