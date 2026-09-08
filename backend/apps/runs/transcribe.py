"""Audio in, words out, and the audio is never kept.

Two providers because the tiers genuinely differ in what they can do, not
because a paywall wanted somewhere to sit. Whisper-family models normalise
disfluencies away by design: ask one how many times somebody said "um" and
the ums were deleted before you asked. So the free tier, which runs on
Groq's whisper-large-v3-turbo at $0.00067 a minute, honestly cannot show a
filler count, and Pro, which runs on AssemblyAI with `disfluencies=true`,
can. On non-native English the measured detection rates are AssemblyAI
0.987, Speechmatics 0.841, Deepgram Nova-3 0.713; Deepgram was the first
pick and is out on both accuracy and price.

The seam is `apps/common/openrouter.py`'s and for the same reason: a
developer's `.env` holds a real key and a suite that could reach it is one
loop away from a bill. Every test runs against `RecordingGateway`.

Bytes arrive, go out to the provider and are dropped. Nothing here writes
audio anywhere, which is what lets "never: audio storage" stay true with a
transcriber behind it.

AssemblyAI is polled rather than told, the same way payments settle: no
webhook endpoint exists in this codebase and none is planned. A minute of
audio comes back in a few seconds, so the poll is bounded and blocking. If
that ever holds a worker too long the fix is the settle pattern - hand the
timing report back at once and let the browser ask for the words - and not
a queue.
"""

import json
import logging
import mimetypes
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger(__name__)

GROQ = "groq"
ASSEMBLYAI = "assemblyai"

# Whisper on Groq is fast; this is the hung-provider ceiling, not the
# expected wait.
TIMEOUT = 45

# AssemblyAI queues then transcribes, so the answer is a poll away. A
# minute of audio is usually done in under ten seconds; past this the
# round gets its timing report and no words, which is a smaller report
# rather than an error in somebody's face.
POLL_TIMEOUT = 40
POLL_EVERY = 1.5

USER_AGENT = "yapholic.com (+https://yapholic.com)"

GROQ_MODEL = "whisper-large-v3-turbo"


class TranscribeError(Exception):
    """No transcript came back. Never a partial one: a caller gets words or
    this, and this is survivable - the round still has its timing."""


@dataclass(frozen=True)
class Transcript:
    text: str
    provider: str
    # How long the audio actually was, as the provider measured it. This
    # is the only honest number for the allowance to charge: the round's
    # own length is reported by the browser, and bytes cannot answer the
    # question at all, since Opus encodes speech anywhere from 6kbps to
    # 128kbps and a megabyte is a minute or an hour depending. Zero from a
    # provider that does not say, and from a call that never came back.
    seconds: float = 0.0
    # (word, start, end) in seconds. AssemblyAI returns these on every
    # response and we were dropping them; they are what lets a pause be
    # drawn inside the sentence it interrupted rather than reported as a
    # number beside it. Empty from a provider that does not send them.
    words: tuple[tuple[str, float, float], ...] = ()


def _multipart(fields: dict[str, str | list[str]], filename: str, blob: bytes) -> tuple[bytes, str]:
    """One file and a few strings, by hand. `urllib` has no multipart and
    the alternative is a dependency for one POST, which is the call
    `mail.py`, `recaptcha.py` and `dodo.py` already made. A list value is
    the field repeated, which is how an array travels in a form."""
    boundary = uuid.uuid4().hex
    marker = f"--{boundary}".encode()
    body = bytearray()
    for name, value in fields.items():
        for one in value if isinstance(value, list) else [value]:
            body += marker + b"\r\n"
            body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n{one}\r\n'.encode()
    body += marker + b"\r\n"
    body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    guessed = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    body += f"Content-Type: {guessed}\r\n\r\n".encode()
    body += blob + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def _post(url: str, *, data: bytes, headers: dict, method: str = "POST") -> dict:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **headers}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
            return json.loads(response.read())
    except (urllib.error.URLError, OSError, ValueError) as exc:
        # The status or the class, never the exception's own text: an
        # HTTPError carries the response body, and the key travels in a
        # header that a body of ours could quote back.
        raise TranscribeError(
            f"the transcriber could not be reached ({getattr(exc, 'code', type(exc).__name__)})"
        ) from exc


@dataclass
class GroqGateway:
    """The free tier. Cheap and fast, and it eats the fillers.

    Asked for `verbose_json` with word timestamps, which costs nothing
    extra and is what lets a free round have its pace drawn through the
    minute and its silences drawn inside the sentence they interrupted.
    The ums are still gone before the answer arrives; timings do not bring
    them back."""

    api_key: str
    base_url: str = "https://api.groq.com/openai/v1"

    def transcribe(self, blob: bytes, filename: str) -> Transcript:
        body, content_type = _multipart(
            {"model": GROQ_MODEL, "response_format": "verbose_json", "timestamp_granularities[]": ["word"]},
            filename,
            blob,
        )
        answer = _post(
            f"{self.base_url.rstrip('/')}/audio/transcriptions",
            data=body,
            headers={"Content-Type": content_type, "Authorization": f"Bearer {self.api_key}"},
        )
        text = (answer.get("text") or "").strip()
        if not text:
            raise TranscribeError("the transcriber returned nothing")
        return Transcript(
            text=text,
            provider=GROQ,
            words=_timed_seconds(answer.get("words")),
            seconds=_seconds(answer.get("duration")),
        )


def _seconds(value) -> float:
    """What the provider says it heard, or nothing. Never negative and
    never a string: this number is charged to somebody's allowance, so a
    provider having a bad day must not credit them."""
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def _timed_seconds(words) -> tuple[tuple[str, float, float], ...]:
    """Whisper's words arrive as `word`, `start`, `end`, in seconds already.
    Nothing that cannot be placed is kept, as with the other provider."""
    out = []
    for word in words or []:
        text = str(word.get("word") or "").strip()
        start, end = word.get("start"), word.get("end")
        if text and start is not None and end is not None:
            out.append((text, round(float(start), 2), round(float(end), 2)))
    return tuple(out)


@dataclass
class AssemblyAIGateway:
    """Pro. Upload, ask, then poll until it is done.

    `disfluencies=True` is the whole reason this one is here: without it
    every provider hands back tidy prose with the ums already removed, and
    the filler count Pro is sold on would be a systematic undercount
    presented as a fact.
    """

    api_key: str
    base_url: str = "https://api.assemblyai.com/v2"

    @property
    def _headers(self) -> dict:
        return {"Authorization": self.api_key}

    def transcribe(self, blob: bytes, filename: str) -> Transcript:
        uploaded = _post(
            f"{self.base_url.rstrip('/')}/upload",
            data=blob,
            headers={**self._headers, "Content-Type": "application/octet-stream"},
        )
        if not (audio_url := uploaded.get("upload_url")):
            raise TranscribeError("the upload was refused")

        started = _post(
            f"{self.base_url.rstrip('/')}/transcript",
            data=json.dumps({"audio_url": audio_url, "disfluencies": True}).encode(),
            headers={**self._headers, "Content-Type": "application/json"},
        )
        if not (job := started.get("id")):
            raise TranscribeError("the transcriber accepted nothing")

        deadline = time.monotonic() + POLL_TIMEOUT
        while True:
            asked = f"{self.base_url.rstrip('/')}/transcript/{job}"
            answer = _post(asked, data=None, headers=self._headers, method="GET")
            status = answer.get("status")
            if status == "completed":
                text = (answer.get("text") or "").strip()
                if not text:
                    raise TranscribeError("the transcriber heard nothing")
                return Transcript(
                    text=text,
                    provider=ASSEMBLYAI,
                    words=_timed(answer.get("words")),
                    # Seconds, like Whisper's. It is the word timings on
                    # this provider that are milliseconds, which `_timed`
                    # divides down; reading this one the same way would
                    # charge a thousandth of what was heard.
                    seconds=_seconds(answer.get("audio_duration")),
                )
            if status == "error":
                raise TranscribeError(str(answer.get("error") or "the transcriber failed"))
            if time.monotonic() >= deadline:
                raise TranscribeError("the transcriber did not finish in time")
            time.sleep(POLL_EVERY)


def _timed(words) -> tuple[tuple[str, float, float], ...]:
    """Milliseconds to seconds, and nothing that cannot be placed. A word
    with no timing is still in the transcript text; it simply cannot be
    drawn on the clock."""
    out = []
    for word in words or []:
        text = (word.get("text") or "").strip()
        start, end = word.get("start"), word.get("end")
        if text and start is not None and end is not None:
            out.append((text, round(start / 1000, 2), round(end / 1000, 2)))
    return tuple(out)


@dataclass
class RecordingGateway:
    """For tests. Hands back what it was told to and remembers the asking."""

    text: str = "um so we should probably like begin"
    provider: str = GROQ
    words: tuple[tuple[str, float, float], ...] = ()
    seconds: float = 0.0
    calls: list[dict] = field(default_factory=list)
    error: Exception | None = None

    def transcribe(self, blob: bytes, filename: str) -> Transcript:
        # Recorded before the error: a failed call is still a call that was
        # made, and it still spends allowance.
        self.calls.append({"bytes": len(blob), "filename": filename})
        if self.error:
            raise self.error
        return Transcript(text=self.text, provider=self.provider, words=self.words, seconds=self.seconds)


def enabled(pro: bool) -> bool:
    key = settings.ASSEMBLY_AI_API_KEY if pro else settings.GROQ_API_KEY
    return bool(key)


_gateways: dict[bool, object] = {}


def gateway(pro: bool):
    if pro not in _gateways:
        if not enabled(pro):
            raise TranscribeError("transcription is not configured")
        _gateways[pro] = (
            AssemblyAIGateway(settings.ASSEMBLY_AI_API_KEY) if pro else GroqGateway(settings.GROQ_API_KEY)
        )
    return _gateways[pro]


def use_gateway(replacement, *, pro: bool | None = None) -> None:
    """Tests, and nothing else. `None` puts the real ones back."""
    global _gateways
    if replacement is None:
        _gateways = {}
    elif pro is None:
        _gateways = {True: replacement, False: replacement}
    else:
        _gateways[pro] = replacement
