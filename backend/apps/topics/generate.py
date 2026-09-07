"""Turning a sentence into twenty topics.

The one thing on this site that costs money to serve, which is why the
interesting part of this module is not the prompt but the ceiling.

Five generations per account per calendar month, counted from the rows
rather than held as a counter, for the reason the streak gives at length:
a stored count drifts the first time a retry or a clock change surprises
it. Per month rather than per account is what makes a lifetime plan safe
beside a metered feature - it bounds what one account can cost in any
month without ever telling somebody they have run out for good.

A failed call still spends one. It reached the model or it did not, and
either way an account that can retry a failure for free has no ceiling.
"""

import datetime as dt
import logging

from apps.topics import openrouter, owned
from apps.topics.models import Generation, Genre

logger = logging.getLogger(__name__)

# Product policy, so code and not env: five a month is what makes the
# lifetime plan safe beside a feature that costs on every use.
PER_MONTH = 5

# More than a genre needs, because the parser drops anything too long or
# already held, and asking for twenty to keep fifteen is cheaper than a
# second call.
WANTED = 20

# Enough for twenty short lines and no more. The ceiling is here to stop a
# runaway, not to shape the answer.
MAX_TOKENS = 900

# Some variety: two people asking for "job interview topics" should not
# get the same twenty lines. Not so much that it wanders off the brief.
TEMPERATURE = 0.8

MAX_PROMPT = 300

SPENT = f"That is {PER_MONTH} generations this month, which is the most an account gets. Paste a list instead."
NEEDS_PROMPT = "Say what you want to practise."
OFF = "Generating topics is not switched on."

SYSTEM = (
    "You write prompts for impromptu speaking practice. A person reads one "
    "aloud and talks about it for a minute, with no preparation.\n\n"
    "Rules:\n"
    f"- Reply with exactly {WANTED} lines and nothing else. No numbering, no "
    "bullets, no preamble, no closing remark.\n"
    "- One prompt per line, at most 12 words.\n"
    "- Each must be speakable for a minute by one person with no research and "
    "no slides.\n"
    "- Vary them. Do not write twenty rewordings of one idea.\n"
    "- No questions that need a yes or no and stop.\n"
    "- Plain language. No jargon the asker did not use."
)


class NoAllowanceLeft(Exception):
    """This account has spent its generations for the calendar month."""


def _month_start(now: dt.datetime | None = None) -> dt.datetime:
    return (now or dt.datetime.now(dt.UTC)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def used(user, *, now: dt.datetime | None = None) -> int:
    if user is None or not getattr(user, "is_authenticated", False):
        return 0
    return Generation.objects.filter(user=user, created_at__gte=_month_start(now)).count()


def left(user, *, now: dt.datetime | None = None) -> int:
    """How many this account has left this month. Zero for a stranger and
    zero when there is no key, so the page can ask one question."""
    if not openrouter.enabled():
        return 0
    return max(0, PER_MONTH - used(user, now=now))


def generate(user, genre: Genre, prompt: str) -> tuple[int, int]:
    """Ask for topics, add what came back, and return (added, left).

    The row is written whatever happens - before the topics, and even when
    the call fails - because it is the ceiling's only record of the
    attempt.
    """
    asked = " ".join(prompt.split())[:MAX_PROMPT]
    if not asked:
        raise ValueError(NEEDS_PROMPT)
    if left(user) <= 0:
        raise NoAllowanceLeft(SPENT)

    row = Generation(user=user, genre=genre, prompt=asked)
    try:
        answer = openrouter.gateway().complete(
            system=SYSTEM,
            prompt=f"Topics about: {asked}",
            model=openrouter_model(),
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
        )
    except openrouter.ModelError as exc:
        row.error = str(exc)[:300]
        row.save()
        logger.warning("generation failed for %s: %s", user.pk, exc)
        raise

    row.model = answer.model[:80]
    row.prompt_tokens = answer.prompt_tokens
    row.completion_tokens = answer.completion_tokens

    # Straight through the parser a paste goes through: a model writes
    # lines, and lines are what that already understands. It also means a
    # model cannot coin a style, since a paste cannot.
    added = owned.add_topics(genre, clean(answer.text))
    row.topics = added
    row.save()
    return added, left(user)


def openrouter_model() -> str:
    from django.conf import settings

    return settings.OPENROUTER_MODEL


def clean(text: str) -> str:
    """Strip the list markers a model adds however firmly it is asked not
    to.

    What makes a number a marker is the punctuation after it, not the
    digits: "1. Low tide" is a numbered line, "1984 was optimistic" is a
    topic and "3 Mile Island" is half of one. Testing for digits alone
    quietly ate both.
    """
    out = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("-*• ").strip()
        head, sep, tail = line.partition(" ")
        if sep and head[:-1].isdigit() and head[-1:] in {".", ")"}:
            line = tail.strip()
        if line:
            out.append(line)
    return "\n".join(out)
