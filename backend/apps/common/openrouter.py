"""The one call to a model, and the seam that keeps it out of the tests.

One turn, one answer: no chat history, no tools, no streaming. The seam is
the shape `apps/payments/dodo.py` uses and for the same reason - a
developer's `.env` holds a real key, and a suite that could reach it is one
loop away from a few hundred billed generations. Every test runs against
`RecordingGateway`.

Here in `common/` because two apps call it: `apps/topics/generate.py`
writes topics from a prompt, and `apps/runs/argument.py` reads back what
somebody said about one. One client, one seam, one place a key is used.

Spend is capped twice over: by an allowance counted per account per
calendar month, and again on the key itself in the provider's dashboard,
which is the one that holds if the first has a bug. Both callers ride an
allowance they already have - generations for topics, transcribed minutes
for a report - so neither adds a counter of its own.

Plain `urllib` rather than the `openai` SDK the card named. The request is
one JSON POST to an OpenAI-shaped endpoint, which is what `mail.py`,
`recaptcha.py` and `dodo.py` already do by hand; the SDK would be a
dependency tree to carry for one function.
"""

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger(__name__)

# Long enough for a slow first token, short enough that a hung provider does
# not hold a worker for a minute. The job is twenty short lines. A caller
# with somebody waiting on the other end passes its own, shorter one.
TIMEOUT = 45

# The same lesson as the payment provider's edge: name the client, or a
# default urllib agent gets an edge refusal nobody can read.
USER_AGENT = "yapholic.com (+https://yapholic.com)"


class ModelError(Exception):
    """The call produced no answer. Never a partial one: a caller either
    gets a completion or this."""


@dataclass(frozen=True)
class Completion:
    text: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


@dataclass
class OpenRouterGateway:
    api_key: str
    base_url: str

    def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int,
        temperature: float,
        timeout: int = TIMEOUT,
    ) -> Completion:
        body = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}/chat/completions",
            data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": USER_AGENT,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
                answer = json.loads(response.read())
        except (urllib.error.URLError, OSError, ValueError) as exc:
            # The status or the class, never the exception's own text: an
            # HTTPError carries the response body, and the key travels in a
            # header where a body of ours could quote it back.
            raise ModelError(f"the model could not be reached ({getattr(exc, 'code', type(exc).__name__)})") from exc

        if error := answer.get("error"):
            raise ModelError(str(error.get("message") or error))
        choices = answer.get("choices") or []
        if not choices:
            raise ModelError("the model returned nothing")

        text = (choices[0].get("message") or {}).get("content") or ""
        if not text.strip():
            # A reasoning model can spend the whole budget thinking and
            # return nothing. Unchecked, that writes no topics and looks
            # like the parser's fault much later.
            raise ModelError(f"{answer.get('model')} returned an empty answer")

        usage = answer.get("usage") or {}
        return Completion(
            text=text,
            model=answer.get("model") or model,
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
        )


@dataclass
class RecordingGateway:
    """For tests. Hands back what it was told to and remembers the asking."""

    text: str = "Low tide\nCeiling fans"
    model: str = "test/model"
    calls: list[dict] = field(default_factory=list)
    error: Exception | None = None

    def complete(self, **kwargs) -> Completion:
        # Recorded before the error: a failed call is still a call that was
        # made, and a test counting them is usually testing exactly that.
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return Completion(text=self.text, model=self.model, prompt_tokens=20, completion_tokens=40)


def enabled() -> bool:
    return bool(settings.OPENROUTER_API_KEY)


def model() -> str:
    """Read at the call and not at import, so a test may override it and
    a deployment may change it without a restart."""
    return settings.OPENROUTER_MODEL


_gateway = None


def gateway():
    global _gateway
    if _gateway is None:
        if not enabled():
            raise ModelError("the model is not configured")
        _gateway = OpenRouterGateway(settings.OPENROUTER_API_KEY, settings.OPENROUTER_BASE_URL)
    return _gateway


def use_gateway(replacement) -> None:
    """Tests, and nothing else. `None` puts the real one back."""
    global _gateway
    _gateway = replacement
