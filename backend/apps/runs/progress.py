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

**Nothing is drawn until there are enough rounds to mean anything.** Under
`ENOUGH` the page says how many more are needed instead of drawing a line
through two points, which is also the one honest way this feature asks
somebody to come back tomorrow.

The window is the plan's, the same `streaks.Rule` the calendar and the run
list already use, so free sees five days of it and a plan sees its own
length. One rule, three features.
"""

import datetime as dt
from dataclasses import dataclass

from apps.runs import streaks
from apps.runs.models import Report, Run
from apps.runs.services import owned_by

# Below this a line is a rumour. Five rounds is enough to see a direction
# without being so many that nobody reaches it in a first week.
ENOUGH = 5

# How many rounds the trend smooths over. Three is enough to flatten one
# bad Monday and short enough that a real change still shows within a week.
SMOOTH = 3

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
    that as a zero would draw an improvement that never happened."""
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
    # Only a provider that keeps disfluencies may contribute a filler rate.
    # A Whisper round's zero would pull the line down and read as progress
    # somebody did not make.
    rates = [row["filler_rate"] if row["provider"] == "assemblyai" else None for row in shown]
    smoothed = _smooth(rates)
    stalls = _smooth([row["opening_stall"] for row in shown])
    gaps = _smooth([row["longest_pause"] for row in shown])

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
