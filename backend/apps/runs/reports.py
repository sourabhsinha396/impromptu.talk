"""Making a report, and the ceiling on the half of it that costs money.

Timing is free and has no ceiling. Voice activity detection happens in the
browser, so the pause map, the opening stall and trail-off cost nothing to
serve and every round gets them, signed in or not, for as long as the site
exists.

Words cost, so words are metered. **Five minutes a calendar month for
free** (owner's call, 2026-09-07) and two hours for Pro, counted from the
rows rather than held as a counter, for the reason the streak gives at
length: a stored count drifts the first time a retry or a clock change
surprises it.

**Minutes, not rounds.** The speak setting goes to ten minutes, so one
round can cost ten times another; an allowance counted in rounds would
undercount spend by that much. This is the whole reason `audio_seconds`
sits on the report row.

A failed call still spends, exactly as a failed generation does. It
reached the provider or it did not, and either way an account that can
retry a failure for free has no ceiling at all.
"""

import datetime as dt
import logging

from apps.runs import analysis, transcribe
from apps.runs.models import Report, Run
from apps.runs.services import owned_by

logger = logging.getLogger(__name__)

# Product policy, so code and not env. Five minutes is roughly five rounds
# at the default length, which is enough to see what the words layer is
# worth without it becoming the free tier.
FREE_MINUTES = 5

# Two hours a month bounds a lifetime plan against a feature that costs on
# every use: at AssemblyAI's rate it is thirty cents a month, so a $39
# buyer maxing it every month takes over a decade to spend what they paid.
PRO_MINUTES = 120


def _month_start(now: dt.datetime | None = None) -> dt.datetime:
    return (now or dt.datetime.now(dt.UTC)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _mine(did: str, user) -> object:
    """Reports on runs this person owns, by the same rule runs use: an
    account spans devices, an unclaimed device sees only its own."""
    return Report.objects.filter(run__in=Run.objects.filter(owned_by(did, user)))


def allowance(pro: bool) -> int:
    return (PRO_MINUTES if pro else FREE_MINUTES) * 60


def used(did: str, user, *, now: dt.datetime | None = None) -> int:
    """Seconds of audio already transcribed this calendar month. Rows that
    never reached a provider are free and are not counted."""
    rows = _mine(did, user).filter(created_at__gte=_month_start(now)).exclude(provider="")
    return sum(row.audio_seconds for row in rows.only("audio_seconds"))


def left(did: str, user, pro: bool, *, now: dt.datetime | None = None) -> int:
    """Seconds left this month. Zero with no key, so a caller asks one
    question rather than two."""
    if not transcribe.enabled(pro):
        return 0
    return max(0, allowance(pro) - used(did, user, now=now))


def make(
    run: Run,
    segments: list,
    *,
    pro: bool = False,
    audio: bytes | None = None,
    filename: str = "round.webm",
) -> Report:
    """One report, and it never raises.

    A round that cannot be transcribed still gets its timing, because the
    half that costs nothing is also the half that works everywhere. A
    provider that is down, unconfigured, or out of allowance is a smaller
    report and never an error in front of somebody who has just finished
    speaking.
    """
    measured = analysis.timing(segments, run.spoken_seconds)
    row = Report(
        run=run,
        segments=[[s, e] for s, e in segments],
        opening_stall=measured.opening_stall,
        longest_pause=measured.longest_pause,
        awkward_pauses=measured.awkward_pauses,
        speaking_ratio=measured.speaking_ratio,
        trail_off=measured.trail_off,
    )

    # Nothing heard is a dead or muted microphone. Sending that to a
    # transcriber spends allowance to be told there were no words.
    if measured.heard and audio and _may_spend(run, pro):
        row.provider = transcribe.ASSEMBLYAI if pro else transcribe.GROQ
        row.audio_seconds = run.spoken_seconds
        try:
            answer = transcribe.gateway(pro).transcribe(audio, filename)
        except transcribe.TranscribeError as exc:
            # The provider stays on the row: the attempt spent allowance
            # whether or not it came back with anything.
            logger.warning("transcription failed for run %s: %s", run.pk, exc)
        else:
            row.provider = answer.provider
            row.transcript = answer.text
            row.words_at = [list(word) for word in answer.words]
            row.fillers_at_transitions = analysis.at_transitions(list(answer.words), measured.pauses)
            if spoken := analysis.words(answer.text, measured.speaking_seconds):
                row.words = spoken.count
                row.pace = spoken.pace
                row.fillers = spoken.fillers
                row.filler_rate = spoken.filler_rate
                row.crutch_words = [list(pair) for pair in spoken.crutch_words]
                row.filler_words = list(spoken.filler_words)

    row.save()
    return row


def _may_spend(run: Run, pro: bool) -> bool:
    """Any allowance at all is enough to start, and a round is never cut in
    half. So the worst overrun is one round past the line, which is a
    friendlier rule than refusing somebody mid-minute and cheaper than the
    arithmetic that would avoid it."""
    return left(run.device_id, run.user, pro) > 0


def render(row: Report, *, pro: bool = False) -> dict:
    """A stored report as the done screen reads it.

    Timing is recomputed from the segments rather than read off the
    columns, so a threshold that moves rewrites what history says it was
    instead of leaving old rounds judged by an old number. The columns stay
    because a year of trend cannot afford to parse a year of JSON.
    """
    measured = analysis.timing(row.segments, row.run.spoken_seconds)
    # Whether anything was actually said, which is not the same question as
    # whether a transcript came back: a provider handed ". . ." for a tone
    # and the page reported nought words a minute as though it were a fact
    # about the speaker.
    said = row.words > 0 or row.fillers > 0
    return {
        "heard": measured.heard,
        "speaking_seconds": measured.speaking_seconds,
        "opening_stall": measured.opening_stall,
        "pauses": [{"at": p.at, "seconds": p.seconds, "awkward": p.awkward} for p in measured.pauses],
        "longest_pause": measured.longest_pause,
        "awkward_pauses": measured.awkward_pauses,
        "speaking_ratio": measured.speaking_ratio,
        "trail_off": measured.trail_off,
        # Null rather than zero: nobody said no words, the round simply was
        # not transcribed, and a page has to be able to tell those apart.
        "words": row.words if said else None,
        # Pace needs words to pace. Nought a minute is never the answer; it
        # means nobody counted, and the page should say nothing instead.
        "pace": row.pace if row.words else None,
        # Only a provider that keeps disfluencies may report a filler
        # count. Whisper deletes them before anybody asks, so a zero from
        # Groq would be a systematic undercount presented as a fact.
        "fillers": row.fillers if row.provider == transcribe.ASSEMBLYAI else None,
        "filler_rate": row.filler_rate if row.provider == transcribe.ASSEMBLYAI else None,
        "crutch_words": [{"word": word, "count": count} for word, count in row.crutch_words],
        # Only where a filler count is honest, for the same reason: Whisper
        # deletes them, so marking none in a Groq transcript would read as
        # a clean round rather than an uncounted one.
        "filler_words": row.filler_words if row.provider == transcribe.ASSEMBLYAI else [],
        "transcript": row.transcript,
        # The transcript with our own silences put back where they fell,
        # which is the one place a pause stops being a number.
        "said": [
            {"kind": part.kind, "text": part.text, "seconds": part.seconds, "awkward": part.awkward}
            for part in analysis.read_back(row.words_at, measured.pauses)
        ],
        "fillers_at_transitions": row.fillers_at_transitions if row.provider == transcribe.ASSEMBLYAI else None,
        # So the read-back can say what it was an answer to, months later.
        "topic": row.run.topic_text,
        "seconds_left": left(row.run.device_id, row.run.user, pro),
    }
