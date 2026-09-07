"""The streak, derived from runs and never stored.

Counting distinct days back from today costs one indexed query and can
never disagree with the runs table. Days are the visitor's own local
days: each row carries the UTC offset of the clock that made it, so a
round finished at 11pm on Tuesday is Tuesday for the person who spoke,
whatever the server thinks and wherever they have travelled since.

This module holds the chain and the grace day. The freeze rule, the
longest streak and the frozen days arrive with the streak rules card.
"""

import datetime as dt

from apps.runs.models import Run
from apps.runs.services import owned_by


def local_date(when: dt.datetime, offset_minutes: int) -> dt.date:
    return (when.astimezone(dt.UTC) + dt.timedelta(minutes=offset_minutes)).date()


def local_dates(did: str, user=None) -> list[dt.date]:
    """Every day practised, newest first, each in the clock that made it."""
    rows = Run.objects.filter(owned_by(did, user)).values_list("created_at", "tz_offset")
    return sorted({local_date(created, offset) for created, offset in rows}, reverse=True)


def current_streak(did: str, offset_minutes: int = 0, user=None, *, now: dt.datetime | None = None) -> int:
    """Days practised in an unbroken chain ending today or yesterday.

    Yesterday still counts: someone who practised last night and opens the
    site at 8am has not broken anything, and telling them they have is a
    good way to lose them. `offset_minutes` is today's clock, the one the
    request carries.
    """
    days = local_dates(did, user)
    if not days:
        return 0
    today = local_date(now or dt.datetime.now(dt.UTC), offset_minutes)
    if days[0] not in (today, today - dt.timedelta(days=1)):
        return 0
    streak = 1
    for earlier, later in zip(days[1:], days, strict=False):
        if (later - earlier).days != 1:
            break
        streak += 1
    return streak
