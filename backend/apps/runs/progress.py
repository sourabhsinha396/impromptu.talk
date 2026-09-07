"""Whether somebody is getting better, which is the thing Pro sells.

A single round's report answers "how did that go". Only a series answers
"am I improving", and that is the question a habit product is actually
for: a report you cannot compare is a readout, and nobody renews a
readout.

Drawn for the person practising, not for a dashboard (owner's call,
2026-09-07). They want three things: proof they got better at what scared
them, one thing to work on next, and to know that a bad day is not a
relapse. So the answer carries **one row per round with the skills a
learner is trying to build** (starting at once, keeping going without
holes, holding the thread, filling the time, landing an ending, dropping a
habit word, range), and the page compares the first rounds with the last,
names the skill furthest from comfortable, and shows the floor rising. All
of it is arithmetic over what a round already stored.

Three decisions shape the lines that stay.

**Three lines and not nine.** Silence in the minute, restarts and the
opening stall are the three that improve with practice, are unambiguous,
and do not swing with the topic. Pace deliberately is not one of them: a
hot take and a story are spoken at different speeds, so a pace line drawn
across mixed genres wanders for reasons that have nothing to do with the
speaker, and a chart that says "worse" on a day somebody did fine is worse
than no chart.

**A rolling average, never the raw points.** One bad round is noise, and a
jagged line through noise reads as a verdict. The trend is smoothed over a
few rounds so a single Monday cannot make somebody think they have
regressed.

**It draws from the second round.** An earlier version waited for five and
smoothed from the first, which was wrong twice over (owner's call): the
wait put an empty box in front of somebody at exactly the moment they were
deciding whether any of this was worth having, and averaging three rounds
together when there are only three flattens the very change it is meant to
show. Two rounds is the least you can compare, and comparing two rounds is
the whole feature.

The window is the plan's, the same `streaks.Rule` the calendar and the run
list already use, so free sees five days of it and a plan sees its own
length. One rule, three features.
"""

import datetime as dt
from dataclasses import dataclass, field

from apps.runs import analysis, streaks, transcribe
from apps.runs.models import Report, Run
from apps.runs.services import owned_by

# The least that can be compared. One round is a report and not a trend;
# two is a before and an after, which is the whole point of the page.
ENOUGH = 2

# How many rounds the trend smooths over once smoothing is worth doing.
SMOOTH = 3

# Smoothing exists to make many points readable, not to hide few. Under
# this it is off entirely: averaging three rounds together when somebody
# has done four turns a real improvement into a shrug, which is the
# opposite of the job.
SMOOTH_FROM = 8

# The most points drawn. A year of practice is a thousand rounds and a line
# with a thousand points is a smear; the newest are the ones anybody is
# asking about.
MOST = 40

# Starting inside this is starting at once. The same edge the round page
# judges the stall against (`lib/report.ts`), kept in step by hand.
QUICK_START = 2.0


@dataclass(frozen=True)
class Point:
    at: dt.datetime
    stall: float
    gap: float
    fillers: float | None
    silence: float
    restarts: float


@dataclass(frozen=True)
class Minute:
    """One round drawn as the bar the done screen already draws, so the
    first and the latest can be put one above the other at the same scale.
    That side by side is the most convincing thing this product can show
    and it costs nothing beyond what is already stored."""

    at: dt.datetime
    seconds: int
    segments: list


@dataclass(frozen=True)
class Round:
    """One round as the skills a learner is building. Every field is
    arithmetic over the stored segments, transcript and word timings; a
    round nothing transcribed has the timing half and None for the rest,
    which a page tells apart from a round that scored nought."""

    id: int
    at: dt.datetime
    genre_slug: str
    prep_seconds: int
    # The speaking setting, and how much of it was used before Done or the
    # bell. Filling the time is the second against the first.
    setting: int
    spoken: int
    stall: float
    # Seconds inside the round with no voice in them: the stall and every
    # pause, and not the time after Done, which is filling the time's.
    silence: float
    gaps: int
    restarts: int
    # Whether the words carried a clock, so a nought in restarts means
    # none rather than uncounted.
    timed: bool
    ended: bool | None
    ums: int | None
    distinct: int | None
    leaned: dict[str, int] = field(default_factory=dict)
    # Whether the topic was answered, and the second the point landed.
    # Both are None on every round nothing read, which the page tells apart
    # from a round that answered nothing.
    answered: str | None = None
    point_at: float | None = None


@dataclass(frozen=True)
class First:
    at: dt.datetime
    run_id: int


@dataclass(frozen=True)
class Progress:
    enough: bool
    needed: int
    counted: int
    points: list[Point]
    first: Minute | None
    latest: Minute | None
    rounds: list[Round] = field(default_factory=list)
    firsts: dict[str, First | None] = field(default_factory=dict)


def _smooth(values: list[float | None], window: int = SMOOTH) -> list[float | None]:
    """A trailing mean over the last few readings, skipping the ones that
    are absent: a round nobody transcribed has no filler rate, and treating
    that as a zero would draw an improvement that never happened.

    A window of one is the honest identity, and that is what a short
    history gets."""
    out: list[float | None] = []
    for index in range(len(values)):
        seen = [v for v in values[max(0, index - window + 1) : index + 1] if v is not None]
        out.append(round(sum(seen) / len(seen), 2) if seen else None)
    return out


def progress(did: str, user=None, rule: streaks.Rule = streaks.FREE, *, now=None) -> Progress:
    """Every report inside the plan's window, oldest first."""
    since = (now or dt.datetime.now(dt.UTC)) - dt.timedelta(days=rule.days)
    rows = list(
        Report.objects.filter(run__in=Run.objects.filter(owned_by(did, user)), created_at__gte=since)
        .select_related("run")
        .order_by("created_at")
    )
    counted = len(rows)
    if counted < ENOUGH:
        return Progress(enough=False, needed=ENOUGH - counted, counted=counted, points=[], first=None, latest=None)

    every = [_round(row) for row in rows]
    shown = rows[-MOST:]
    recent = every[-MOST:]
    window = SMOOTH if len(shown) >= SMOOTH_FROM else 1
    # Only a provider that keeps disfluencies may contribute a filler rate.
    # A Whisper round's zero would pull the line down and read as progress
    # somebody did not make.
    rates = [row.filler_rate if row.provider == transcribe.ASSEMBLYAI else None for row in shown]
    smoothed = _smooth(rates, window)
    stalls = _smooth([row.opening_stall for row in shown], window)
    gaps = _smooth([row.longest_pause for row in shown], window)
    silences = _smooth([one.silence for one in recent], window)
    restarts = _smooth([float(one.restarts) for one in recent], window)

    points = [
        Point(
            at=row.created_at,
            stall=stalls[i] or 0.0,
            gap=gaps[i] or 0.0,
            fillers=smoothed[i],
            silence=silences[i] or 0.0,
            restarts=restarts[i] or 0.0,
        )
        for i, row in enumerate(shown)
    ]
    return Progress(
        enough=True,
        needed=0,
        counted=counted,
        points=points,
        first=_minute(rows[0]),
        latest=_minute(rows[-1]),
        rounds=every,
        firsts=_firsts(every),
    )


def _minute(row: Report) -> Minute:
    return Minute(at=row.created_at, seconds=row.run.spoken_seconds, segments=row.segments)


def _round(row: Report) -> Round:
    run = row.run
    words_at = [tuple(word) for word in row.words_at]
    has_words = row.words > 0
    honest = row.provider == transcribe.ASSEMBLYAI
    speaking = run.spoken_seconds * row.speaking_ratio
    return Round(
        id=run.pk,
        at=row.created_at,
        genre_slug=run.genre_slug,
        prep_seconds=run.prep_seconds,
        setting=run.speak_seconds,
        spoken=run.spoken_seconds,
        stall=row.opening_stall,
        silence=max(0.0, round(run.spoken_seconds - speaking, 1)),
        gaps=row.awkward_pauses,
        restarts=len(analysis.restarts(words_at)),
        timed=bool(words_at),
        ended=analysis.ended_clean(row.transcript) if has_words else None,
        ums=row.fillers if honest else None,
        distinct=analysis.distinct_words(row.transcript) if has_words else None,
        leaned=dict(analysis.leaned_on(row.transcript)) if has_words else {},
        answered=row.answered or None,
        point_at=_point_at(row, words_at),
    )


def _point_at(row: Report, words_at: list) -> float | None:
    """The second the point landed, which is the one thing about the case
    that moves with practice: the same claim made at 0:41 in August and at
    0:06 in September is the whole of what got better. None where nothing
    read the round and where a round made no point at all, never nought."""
    roles = list(row.roles)
    if "point" not in roles:
        return None
    said = analysis.sentences(row.transcript)
    spans = analysis.sentence_spans(words_at, said)
    index = roles.index("point")
    span = spans[index] if index < len(spans) else None
    return span.start if span else None


# The milestones, each the first round that met it. A round has to have
# been able to meet one for it to count: no restarts means nothing where
# no words carried a clock, and no ums means nothing where nothing counted
# them, so those two wait for a round that could have failed.
FIRSTS = {
    "no_holes": lambda r: r.gaps == 0,
    "no_restarts": lambda r: r.timed and r.restarts == 0,
    "clean_ending": lambda r: r.ended is True,
    "full_minute": lambda r: r.spoken >= r.setting,
    "quick_start": lambda r: r.stall <= QUICK_START,
    "no_ums": lambda r: r.ums == 0,
}


def _firsts(rounds: list[Round]) -> dict[str, First | None]:
    out: dict[str, First | None] = {}
    for key, met in FIRSTS.items():
        found = next((one for one in rounds if met(one)), None)
        out[key] = First(at=found.at, run_id=found.id) if found else None
    return out
