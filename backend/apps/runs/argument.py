"""What the topic asked for, and whether it was given.

Everything else in this app measures how somebody spoke. Nothing in it
could say whether they did what they were asked, and that is the thing a
learner most needs to hear: run 30 answered "Argue for owning one good
pen" with a story about a pen fight, and the report said 143 words a
minute and one um.

**Plain words.** The two sentences it writes are the only prose on the
report, and they are read by somebody practising in a second language, so
the prompt asks for everyday words and no idioms: everything the page
writes for itself follows the same rule.

**Structure, never prose.** The model is given the topic, the sentences
the report already split, and how the minute was delivered, and it answers
with a role for each sentence, one word for whether the topic was
answered, and two short sentences. That is the whole answer. The three
refusals the report was built on hold: no score, no rewrite of anybody's
sentence, no paragraph. A role is a fact about one sentence, so it can be
drawn on the clock and counted across thirty rounds; a paragraph could be
neither, and a report made of paragraphs would mean the progress view
could never exist.

**Once, and then stored.** Temperature does not make a model repeat
itself; storage does. The answer is written on the report row when the
round is transcribed and never asked for again, so a round read back in a
year says exactly what it said the day it was spoken.

**Fed the delivery report so it cannot contradict it.** The numbers go
into the prompt, which is what stops the model praising an ending that the
bell cut off.

Nothing here ever raises at the caller. A refusal, an empty answer, an
answer in the wrong shape or a provider having a day leaves the report as
it was, and the page draws no section rather than an apology.
"""

import json
import logging
from dataclasses import dataclass

from apps.common import openrouter
from apps.runs.analysis import Sentence

logger = logging.getLogger(__name__)

# What a sentence was doing. Six, because the page draws each one and a
# seventh would be a lesson rather than a key.
ROLES = ("point", "reason", "example", "setup", "aside", "close")

# Whether the topic was answered. Three, because "half" is the commonest
# real state - the point made in the first breath and then abandoned for
# the story - and a yes or no would have to call that one or the other.
ANSWERED = ("yes", "half", "no")

# Somebody is watching the done screen fill in, so this call waits behind
# a transcription that already took seconds. Shorter than the client's own
# ceiling for that reason: a model having a slow day costs the section,
# never the report.
TIMEOUT = 15

# A ceiling and not a shape: the answer is a role per sentence and two
# short lines, and a ten-minute round has a hundred sentences to name.
MAX_TOKENS = 1200

# The prompt carries one line per sentence and the answer must carry one
# role per sentence, so both grow with the transcript and only the answer
# has a ceiling. Past roughly three hundred roles the budget above runs
# out mid-array, `parse` refuses the truncated shape, and the prompt has
# been paid for to be thrown away - the failure gets quieter the more it
# costs. A ten-minute round, the longest the site offers, has about a
# hundred sentences.
MOST_SENTENCES = 300

# As near to the same answer twice as a model gets. What actually pins it
# is that the answer is stored, but there is no reason to ask for variety
# in a judgement.
TEMPERATURE = 0.2

# The two sentences are asked for at twenty words and refused past this.
# A cap that truncates would leave somebody half a sentence; a cap that
# refuses keeps the promise that this report never writes prose.
MOST_WORDS = 22

SYSTEM = (
    "You read one minute of impromptu speaking and say whether the speaker "
    "did what the topic asked.\n\n"
    "You are given the topic, the sentences they spoke in order, and how "
    "they delivered it. Reply with one JSON object and nothing else, in "
    'this shape: {"answered": "...", "roles": ["...", "..."], "verdict": '
    '"...", "next": "..."}\n\n'
    '- "roles" holds exactly one word per numbered sentence, in the same '
    "order, each one of: point, reason, example, setup, aside, close.\n"
    "  point: the sentence that does what the topic asked. The claim in an "
    "argument, the thing itself in an explanation, the premise in a story. "
    "At most one sentence, and only when one really does it.\n"
    "  reason: why the point holds. example: a case or a story that shows "
    "it.\n"
    "  setup: restating the topic, or saying that it matters, before any "
    "thought of their own.\n"
    "  aside: off the point. close: the sentence that lands it again or "
    "wraps up.\n"
    '- "answered": yes if they did what the topic asked, half if they began '
    "to and drifted, no if they never did it. Say no only when nothing they "
    "said was the thing asked for, and then give no sentence the point "
    "role.\n"
    '- "verdict": one sentence, at most 20 words, saying what happened. '
    "Address them as you. Name what they actually said, not how it sounded.\n"
    '- "next": one sentence, at most 20 words, one thing to do differently '
    "next time. About the case they made. Never about pace, pauses or "
    "filler words, which they are already told about.\n\n"
    "Write both sentences for somebody who is still learning English. "
    "Everyday words, short sentences, no idioms and no figures of speech: "
    "say \"you slowed down at the end\", never \"you faded\". A reader who "
    "has to work out what a phrase means has learnt nothing from it.\n\n"
    "Never score them out of anything. Never rewrite their sentences. Never "
    "write more than the two sentences asked for. Judge only what is in "
    "front of you: a minute with no preparation is short, and a plain "
    "answer well made is a good one."
)


@dataclass(frozen=True)
class Delivery:
    """The half of the report that is already measured, so the model
    cannot contradict a number the page draws beside it."""

    stall: float
    pace: int | None
    longest_pause: float
    ended_clean: bool


@dataclass(frozen=True)
class Case:
    answered: str
    roles: tuple[str, ...]
    verdict: str
    advice: str


def enabled() -> bool:
    return openrouter.enabled()


def read(topic: str, said: tuple[Sentence, ...], delivery: Delivery) -> Case | None:
    """One call, one case, or None and a line in the log."""
    if not enabled() or not said or not topic:
        return None
    if len(said) > MOST_SENTENCES:
        # Refused rather than trimmed: a case read from the first three
        # hundred sentences of a longer round would be a judgement on a
        # round nobody spoke, presented beside the whole of it.
        logger.warning("the case was not read: %s sentences is more than one round", len(said))
        return None
    try:
        answer = openrouter.gateway().complete(
            system=SYSTEM,
            prompt=_prompt(topic, said, delivery),
            model=openrouter.model(),
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            timeout=TIMEOUT,
        )
    except openrouter.ModelError as exc:
        logger.warning("the case could not be read: %s", exc)
        return None
    case = parse(answer.text, len(said))
    if case is None:
        logger.warning("the case came back in a shape we do not take")
    return case


def _prompt(topic: str, said: tuple[Sentence, ...], delivery: Delivery) -> str:
    lines = "\n".join(f"{index}. {sentence.text}" for index, sentence in enumerate(said, start=1))
    return f"Topic: {topic}\n\nHow it was delivered: {_delivery(delivery)}\n\nSentences:\n{lines}"


def _delivery(delivery: Delivery) -> str:
    parts = [f"began speaking {delivery.stall:.1f} seconds in"]
    if delivery.pace:
        parts.append(f"{delivery.pace} words a minute")
    parts.append(f"longest silence {delivery.longest_pause:.1f} seconds")
    # The one delivery fact that changes what the last sentence means: a
    # close cut off by the bell is not a close somebody chose not to make.
    parts.append("finished on a full stop" if delivery.ended_clean else "the last sentence was cut off")
    return ", ".join(parts)


def parse(text: str, count: int) -> Case | None:
    """The answer, or None for anything that is not exactly the shape asked
    for. Kept separate from the call so a suite can hold the edges without
    a gateway."""
    body = _object(text)
    if body is None:
        return None

    answered = str(body.get("answered", "")).strip().lower()
    if answered not in ANSWERED:
        return None

    roles = body.get("roles")
    if not isinstance(roles, list) or len(roles) != count:
        # One role per sentence or nothing. A tail with no role would need
        # a seventh colour on the page meaning "the model stopped", and
        # every drawing under it would be short by the same amount.
        return None
    named = tuple(str(role).strip().lower() for role in roles)
    if any(role not in ROLES for role in named):
        return None

    # A verdict of "missed it" over a sentence drawn as the point is the
    # report arguing with itself, which is the one thing that makes every
    # other number on the page worth less.
    if answered == "no" and "point" in named:
        return None

    verdict = _sentence(body.get("verdict"))
    advice = _sentence(body.get("next"))
    if not verdict or not advice:
        return None
    return Case(answered=answered, roles=named, verdict=verdict, advice=advice)


def _object(text: str) -> dict | None:
    """The JSON in the answer, however it was wrapped. A model adds fences
    and a preamble however firmly it is asked not to, exactly as it adds
    list markers to twenty topics."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        body = json.loads(text[start : end + 1])
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _sentence(value) -> str:
    if not isinstance(value, str):
        return ""
    said = " ".join(value.split())
    return said if said and len(said.split(" ")) <= MOST_WORDS else ""

