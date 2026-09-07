"""Whether somebody is getting better, which is the thing Pro sells.

A single round's report answers "how did that go". Only a series answers
"am I improving", and that is the question a habit product is actually
for: a report you cannot compare is a readout, and nobody renews a
readout.

Three decisions shape what is here.

**Three metrics and not nine.** The opening stall, the longest gap and the
filler rate are the three that improve with practice, are unambiguous, and
do not swing with the topic. Pace deliberately is not one of them: a hot
take and a story are spoken at different speeds, so a pace line drawn
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
from dataclasses import dataclass

from apps.runs import streaks
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


@dataclass(frozen=True)
class Point:
    at: dt.datetime
    stall: float
    gap: float
    fillers: float | None


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
class Progress:
    enough: bool
    needed: int
    counted: int
    points: list[Point]
    first: Minute | None
    latest: Minute | None


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
        .order_by("created_at")
        .values(
            "created_at",
            "opening_stall",
            "longest_pause",
            "filler_rate",
            "provider",
            "segments",
            "run__spoken_seconds",
        )
    )
    counted = len(rows)
    if counted < ENOUGH:
        return Progress(enough=False, needed=ENOUGH - counted, counted=counted, points=[], first=None, latest=None)

    shown = rows[-MOST:]
    window = SMOOTH if len(shown) >= SMOOTH_FROM else 1
    # Only a provider that keeps disfluencies may contribute a filler rate.
    # A Whisper round's zero would pull the line down and read as progress
    # somebody did not make.
    rates = [row["filler_rate"] if row["provider"] == "assemblyai" else None for row in shown]
    smoothed = _smooth(rates, window)
    stalls = _smooth([row["opening_stall"] for row in shown], window)
    gaps = _smooth([row["longest_pause"] for row in shown], window)

    points = [
        Point(at=row["created_at"], stall=stalls[i] or 0.0, gap=gaps[i] or 0.0, fillers=smoothed[i])
        for i, row in enumerate(shown)
    ]
    return Progress(
        enough=True,
        needed=0,
        counted=counted,
        points=points,
        first=_minute(rows[0]),
        latest=_minute(rows[-1]),
    )


def _minute(row: dict) -> Minute:
    return Minute(at=row["created_at"], seconds=row["run__spoken_seconds"], segments=row["segments"])
