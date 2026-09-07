"""What somebody has done, in the shape the streak page and a shared page
render it. One place, so the two cannot drift: the calendar's window and
the frozen days come from the same walk the headline number does.

Nothing here knows about HTTP or who is allowed to look; ownership is
settled by the caller and arrives as the device and the user.
"""

import datetime as dt
from dataclasses import dataclass

from apps.runs import streaks
from apps.runs.models import Run
from apps.runs.services import owned_by


@dataclass(frozen=True)
class Day:
    date: dt.date
    count: int
    frozen: bool


@dataclass(frozen=True)
class Recent:
    # The row's own id, so a past round can be opened again. Everything
    # about it is stored and until now none of it was reachable: the report
    # was shown once on the done screen and then gone, while Pro was sold
    # on keeping exactly that.
    id: int
    topic_text: str
    genre_slug: str
    at: dt.datetime
    # Whether there is anything to open. A round practised before the
    # report existed, or with no microphone, has none.
    has_report: bool


@dataclass(frozen=True)
class History:
    summary: streaks.Summary
    days: int
    calendar: list[Day]
    recent: list[Recent]
    runs_kept: int


def history(did: str, offset_minutes: int = 0, user=None, rule: streaks.Rule = streaks.FREE, *, now=None) -> History:
    """The summary, a calendar exactly as long as the plan tracks ending on
    today, and the newest runs up to the plan's cap. Days are the visitor's
    own, each row in the clock that made it and today in the clock asking,
    the same way the streak counts them."""
    mine = owned_by(did, user)
    summary = streaks.summary(did, offset_minutes, user, rule, now=now)
    today = streaks.local_date(now or dt.datetime.now(dt.UTC), offset_minutes)

    counts: dict[dt.date, int] = {}
    for created, tz in Run.objects.filter(mine).values_list("created_at", "tz_offset"):
        day = streaks.local_date(created, tz)
        counts[day] = counts.get(day, 0) + 1

    start = today - dt.timedelta(days=rule.days - 1)
    calendar = [
        Day(date=day, count=counts.get(day, 0), frozen=day in summary.frozen)
        for day in (start + dt.timedelta(days=n) for n in range(rule.days))
    ]
    recent = [
        Recent(id=pk, topic_text=text, genre_slug=slug, at=at, has_report=report is not None)
        for pk, text, slug, at, report in Run.objects.filter(mine)
        .order_by("-created_at", "-id")
        .values_list("id", "topic_text", "genre_slug", "created_at", "report__id")[: rule.runs]
    ]
    return History(summary=summary, days=rule.days, calendar=calendar, recent=recent, runs_kept=rule.runs)
