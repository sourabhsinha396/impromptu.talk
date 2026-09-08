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

from apps.runs import analysis, argument, transcribe
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

# The longest round the product offers is ten minutes (SPEC: speak from 1
# to 10 minutes). `MAX_SECONDS` on the row is two hours, which is the
# sanity bound on a number rather than a length anybody can practise, so a
# round claiming more than this was not made by the site. Its timing is
# still read and stored; only the half that costs money is refused.
#
# This is also what keeps the AssemblyAI poll honest. Abandoning the poll
# does not cancel the job, so audio longer than `POLL_TIMEOUT` can absorb
# is billed in full and then thrown away. Ten minutes comes back in well
# under the forty seconds that loop waits.
MOST_SECONDS = 11 * 60

# The most audio a second of round may carry.
#
# This is a plausibility check and not the ceiling on spend: a byte count
# cannot bound a duration, because Opus encodes speech anywhere from
# 6kbps to 128kbps and the same megabyte is a minute or twenty. What
# bounds spend is the charge, which is the length the provider says it
# heard. This only refuses the uploads that cannot belong to the round
# they arrived with, before any of it is read into memory.
#
# Browsers record mono speech at 128kbps at most - Chrome's MediaRecorder
# default, and Safari's AAC is lower - which is 16KB a second. Twice that
# refuses no real recording.
BYTES_A_SECOND = 32 * 1024

# Container headers and a beat either side of the ticker, so a very short
# round is not refused for its overhead.
AUDIO_HEADROOM = 256 * 1024

# And a flat backstop over the top of that, because the rule above scales
# with the round and would otherwise let the longest one carry more than
# the flat twelve megabytes it replaced. A ten-minute round at 128kbps is
# 9.6MB, so this clears the longest real recording with room over.
MAX_AUDIO = 12 * 1024 * 1024

# How far the browser's timeline may run past the round before it is a
# fault rather than rounding. The ticker stops a beat after the bell, so a
# fraction of a second over is normal; seconds over is the browser's clock
# running fast, which is what a leaked ticker does. Run 30 was a 58 second
# round whose sound ended at 226 seconds, with an opening stall of 7 where
# the transcriber heard the first word at 2. `analysis._clean` clips the
# overrun in silence and reports a stall and a pause map wrong by the same
# factor, so it is worth a line in the log while it is happening.
CLOCK_SLACK = 1.0


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
    _check_clock(run, segments)
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
    #
    # `may_send` is asked again here rather than only at the route. The
    # route asks it of the upload's size so the bytes are never read; this
    # asks it of the bytes, so the rule holds for any caller and cannot be
    # lost by a route that forgets it. It is the one guard between a
    # number the browser reported and a bill somebody else pays.
    if measured.heard and audio and may_send(run, len(audio)) and _may_spend(run, pro):
        row.provider = transcribe.ASSEMBLYAI if pro else transcribe.GROQ
        # The round's own length until the provider says otherwise: a
        # call that never comes back still spends, and `may_send` has
        # already bounded the blob against this same number.
        row.audio_seconds = run.spoken_seconds
        try:
            answer = transcribe.gateway(pro).transcribe(audio, filename)
        except transcribe.TranscribeError as exc:
            # The provider stays on the row: the attempt spent allowance
            # whether or not it came back with anything.
            logger.warning("transcription failed for run %s: %s", run.pk, exc)
        else:
            row.provider = answer.provider
            # What the provider actually heard, which is the only number
            # here that nobody on the other end chose. Never less than the
            # round claimed, so finishing early still costs the round.
            row.audio_seconds = max(row.audio_seconds, round(answer.seconds))
            row.transcript = answer.text
            row.words_at = [list(word) for word in answer.words]
            row.fillers_at_transitions = analysis.at_transitions(list(answer.words), measured.pauses)
            if spoken := analysis.words(answer.text, measured.speaking_seconds, analysis.clock_seconds(measured)):
                row.words = spoken.count
                row.pace = spoken.pace
                row.fillers = spoken.fillers
                row.filler_rate = spoken.filler_rate
                row.crutch_words = [list(pair) for pair in spoken.crutch_words]
                row.filler_words = list(spoken.filler_words)

    # What the topic asked for, and whether it was given. Pro's, and only
    # where words came back: the call needs sentences to read, and those
    # are already paid for in transcribed minutes, so nothing new is
    # counted here.
    if pro and row.transcript:
        _read_case(row, run, measured)

    row.save()
    return row


def _read_case(row: Report, run: Run, measured: analysis.Timing) -> None:
    """The one model call in this app. It never raises and never blocks
    the row: a section that does not arrive is a smaller page, where a
    round that failed to save is somebody's lost minute."""
    case = argument.read(
        run.topic_text,
        analysis.sentences(row.transcript),
        argument.Delivery(
            stall=measured.opening_stall,
            # Nought a minute means nobody counted, and a prompt that said
            # so would have the model explaining a pace that was never
            # measured.
            pace=row.pace or None,
            longest_pause=measured.longest_pause,
            ended_clean=analysis.ended_clean(row.transcript),
        ),
    )
    if case is None:
        return
    row.answered = case.answered
    row.roles = list(case.roles)
    row.verdict = case.verdict
    row.advice = case.advice


def _check_clock(run: Run, segments: list) -> None:
    """The browser's clock against the round it says it measured. A warning
    and nothing more: the backend cannot know the factor, and the fix
    belongs in the browser that measured it."""
    ends = [float(end) for _, end in segments]
    if ends and max(ends) > run.spoken_seconds + CLOCK_SLACK:
        logger.warning(
            "timeline overruns run %s: sound ends at %.2fs in a %ss round", run.pk, max(ends), run.spoken_seconds
        )


def may_send(run: Run, size: int) -> bool:
    """Whether audio this big can honestly belong to a round this long.

    Asked before the upload is read into memory, because the answer needs
    only its size. A refusal is a smaller report and never an error: the
    timing half is computed from the timeline and costs nothing, exactly
    as it is for a round with no microphone or no allowance left.
    """
    if run.spoken_seconds > MOST_SECONDS:
        logger.warning(
            "audio refused for run %s: a %ss round is longer than any the site offers", run.pk, run.spoken_seconds
        )
        return False
    ceiling = min(MAX_AUDIO, AUDIO_HEADROOM + run.spoken_seconds * BYTES_A_SECOND)
    if size > ceiling:
        logger.warning(
            "audio refused for run %s: %s bytes on a %ss round, over the %s ceiling",
            run.pk,
            size,
            run.spoken_seconds,
            ceiling,
        )
        return False
    return True


def _may_spend(run: Run, pro: bool) -> bool:
    """Any allowance at all is enough to start, and a round is never cut in
    half. So the worst overrun is one round past the line, which is a
    friendlier rule than refusing somebody mid-minute and cheaper than the
    arithmetic that would avoid it."""
    return left(run.device_id, run.user, pro) > 0


# How many past rounds "your usual" is the mean of. Twelve is a fortnight
# of daily practice: recent enough to still be you, long enough that one
# bad Monday cannot move it.
USUAL_ROUNDS = 12

# Under this there is no usual, only a previous round, and a mean of one
# round is a comparison dressed up as a baseline.
USUAL_LEAST = 2


def usual(row: Report, *, pro: bool) -> dict | None:
    """What this person usually does: the mean of their last rounds before
    this one, so a round read back months later is compared with the person
    who spoke it and not with who they became.

    Pro's, because the baseline from your own past is what the plan sells.
    Only rounds with words count, so the pace has something to be the mean
    of; the filler rate is the mean of the rounds a transcriber that keeps
    fillers saw, or absent."""
    if not pro:
        return None
    rows = list(
        _mine(row.run.device_id, row.run.user)
        .exclude(pk=row.pk)
        .filter(created_at__lt=row.created_at, words__gt=0)
        .select_related("run")
        .order_by("-created_at")[:USUAL_ROUNDS]
    )
    if len(rows) < USUAL_LEAST:
        return None
    paces: list[int] = []
    stalls: list[float] = []
    gaps: list[float] = []
    rates: list[float] = []
    longest: list[int] = []
    for past in rows:
        measured = analysis.timing(past.segments, past.run.spoken_seconds)
        spoken = analysis.words(past.transcript, measured.speaking_seconds, analysis.clock_seconds(measured))
        if spoken and spoken.pace:
            paces.append(spoken.pace)
        stalls.append(measured.opening_stall)
        gaps.append(measured.longest_pause)
        if past.provider == transcribe.ASSEMBLYAI:
            rates.append(past.filler_rate)
        if said := analysis.sentences(past.transcript):
            longest.append(max(sentence.words for sentence in said))

    def mean(values, places=1):
        if not values:
            return None
        out = round(sum(values) / len(values), places)
        return int(out) if places == 0 else out

    return {
        "pace": mean(paces, 0),
        "stall": mean(stalls),
        "gap": mean(gaps),
        "fillers": mean(rates),
        "sentence": mean(longest, 0),
        "rounds": len(rows),
    }


def _sentences(row: Report, words_at: list) -> list[dict]:
    lines = analysis.sentences(row.transcript)
    spans = analysis.sentence_spans(words_at, lines)
    roles = list(row.roles)
    return [
        {
            "text": line.text,
            "words": line.words,
            "role": roles[index] if index < len(roles) else "",
            "at": spans[index].start if spans[index] else None,
            "end": spans[index].end if spans[index] else None,
        }
        for index, line in enumerate(lines)
    ]


def render(row: Report, *, pro: bool = False) -> dict:
    """A stored report as the done screen and the round's own page read it.

    Timing is recomputed from the segments rather than read off the
    columns, so a threshold that moves rewrites what history says it was
    instead of leaving old rounds judged by an old number. Pace is
    recomputed too, for the same reason: it moved from speaking time to the
    clock, and a round from before that day should read by the same rule
    as one from after. The columns stay because a year of trend cannot
    afford to parse a year of JSON.
    """
    measured = analysis.timing(row.segments, row.run.spoken_seconds)
    # Whether anything was actually said, which is not the same question as
    # whether a transcript came back: a provider handed ". . ." for a tone
    # and the page reported nought words a minute as though it were a fact
    # about the speaker.
    said = row.words > 0 or row.fillers > 0
    spoken = (
        analysis.words(row.transcript, measured.speaking_seconds, analysis.clock_seconds(measured))
        if measured.heard
        else None
    )
    # Only a provider that keeps disfluencies may say anything about
    # fillers: where they fell, how many of each. Whisper deletes them
    # before anybody asks, so a Groq round says nothing rather than none.
    honest = row.provider == transcribe.ASSEMBLYAI
    words_at = [tuple(word) for word in row.words_at]
    found = analysis.restarts(words_at)
    return {
        "pace_curve": [
            {"start": p.start, "end": p.end, "wpm": p.wpm}
            for p in analysis.pace_curve(words_at, row.run.spoken_seconds)
        ],
        "filler_times": [{"word": f.word, "at": f.at} for f in analysis.filler_times(words_at)] if honest else [],
        "filler_counts": [{"word": w, "count": c} for w, c in analysis.filler_counts(row.transcript)] if honest else [],
        "leaned_on": [{"word": w, "count": c} for w, c in analysis.leaned_on(row.transcript)],
        "restarts": [{"quote": r.quote, "at": r.at} for r in found],
        "repeats": [
            {"phrase": p, "count": c} for p, c in analysis.repeats(row.transcript, tuple(r.quote for r in found))
        ],
        # Each sentence with what it was doing and when it was said. The
        # role is the model's and is empty on a round nothing read; the
        # span is arithmetic over the word clock and is there for any round
        # that carries one.
        "sentences": _sentences(row, words_at),
        # The one part of this report a model wrote, stored on the row and
        # returned to whoever owns the round, Pro today or not: a judgement
        # somebody earned is not withdrawn when a plan lapses.
        "case": (
            {"answered": row.answered, "verdict": row.verdict, "advice": row.advice} if row.read_back else None
        ),
        "ended_clean": analysis.ended_clean(row.transcript) if row.transcript else False,
        "usual": usual(row, pro=pro),
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
        "pace": spoken.pace if spoken and spoken.pace and row.words else None,
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
            {"kind": part.kind, "text": part.text, "seconds": part.seconds, "awkward": part.awkward, "at": part.at}
            for part in analysis.read_back(words_at, measured.pauses)
        ],
        "fillers_at_transitions": row.fillers_at_transitions if row.provider == transcribe.ASSEMBLYAI else None,
        # So the read-back can say what it was an answer to, months later.
        "topic": row.run.topic_text,
        "at": row.created_at.isoformat(),
        "genre_slug": row.run.genre_slug,
        "seconds_left": left(row.run.device_id, row.run.user, pro),
    }
