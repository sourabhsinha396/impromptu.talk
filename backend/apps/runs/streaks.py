"""Streaks, derived from runs and never stored.

A stored counter drifts the first time a timezone, a retry or a clock
change surprises it. Counting distinct days back from today costs one
indexed query and can never disagree with the runs table.

Days are the visitor's own local days. Each row carries the UTC offset of
the clock that made it, so a round finished at 11pm on Tuesday is Tuesday
for the person who spoke, whatever the server thinks and wherever they
have travelled since; "today" is the clock of the request asking.

The rule a streak is counted under is the plan's (owner's call, card 16).
Free tracks five days: the number never reads above five and a missed day
ends it. Pro tracks as many days as the plan lasts, thirty for a month,
365 for a year and for lifetime, and survives a couple of missed days a
calendar month. When Pro lapses the free rule takes over, and the number
drops to what five days can show. Both are counting rules and nothing is
stored: no inventory, no table, no purchase of its own, so the answer
cannot disagree with the runs table and buying Pro repairs the gaps
already behind you, because only the rule changed.
"""

import datetime as dt
from dataclasses import dataclass, field

from apps.runs.models import Run
from apps.runs.services import owned_by, totals

# Missed days a Pro streak survives, per calendar month. Two covers a
# weekend away, which is what people actually lose a streak to. Per
# calendar month rather than per streak so a long streak keeps being
# forgiven, and small enough that practising every other day still breaks,
# which a streak that never breaks would not be worth having.
FREEZES_PER_MONTH = 2

# How many days each tier tracks. Five is what the free page shows, and
# the most its streak reads; a Pro plan tracks its own length, and nothing
# tracks more than a year, lifetime included.
FREE_DAYS = 5
PRO_DAYS_MAX = 365

# How many recent runs each tier lists. Pro lifts the cap rather than
# removing it: a list of ten thousand rows is its own problem. The rows
# themselves are never deleted at either cap; the view is what is gated.
FREE_RUNS = 25
PRO_RUNS = 1000


@dataclass(frozen=True)
class Rule:
    """What a plan shows of somebody's practice: how many days back the
    streak looks, whether a gap can be bridged, how many runs are listed."""

    days: int
    freezes: bool
    runs: int


FREE = Rule(days=FREE_DAYS, freezes=False, runs=FREE_RUNS)


def pro_rule(plan_days: int) -> Rule:
    """The rule for a Pro plan that lasts `plan_days`: a month tracks
    thirty, a year 365, lifetime is capped at a year."""
    return Rule(days=max(1, min(plan_days, PRO_DAYS_MAX)), freezes=True, runs=PRO_RUNS)


def local_date(when: dt.datetime, offset_minutes: int) -> dt.date:
    return (when.astimezone(dt.UTC) + dt.timedelta(minutes=offset_minutes)).date()


def local_dates(did: str, user=None) -> list[dt.date]:
    """Every day practised, newest first, each in the clock that made it."""
    rows = Run.objects.filter(owned_by(did, user)).values_list("created_at", "tz_offset")
    return sorted({local_date(created, offset) for created, offset in rows}, reverse=True)


def _freeze(earlier: dt.date, later: dt.date, spent: dict[tuple[int, int], int]) -> bool:
    """Cover the days between two practice days, or leave `spent` untouched.

    All or nothing: a gap half-covered is still a broken streak, so a run
    that cannot be paid for in full must not spend the allowance it would
    have used.
    """
    missed = (later - earlier).days - 1
    # Consecutive days land in at most two calendar months, so a gap longer
    # than two months' allowance can never be covered however it falls. The
    # guard is what stops a year away walking a year of dates.
    if missed > 2 * FREEZES_PER_MONTH:
        return False
    want = dict(spent)
    for n in range(1, missed + 1):
        day = earlier + dt.timedelta(days=n)
        month = (day.year, day.month)
        want[month] = want.get(month, 0) + 1
        if want[month] > FREEZES_PER_MONTH:
            return False
    spent.update(want)
    return True


def _walk(days: list[dt.date], today: dt.date, rule: Rule) -> tuple[int, set[dt.date]]:
    """The chain ending today or yesterday, walked once and stopped at the
    rule's length: how many days it reads and the holes bridged to get
    there, so the count and the calendar can never disagree about which
    days were frozen.

    Yesterday still counts: someone who practised last night and opens the
    site at 8am has not broken anything, and telling them they have is a
    good way to lose them. Two things a freeze deliberately does not do: a
    frozen day does not count, because the number is days spoken and
    inflating it would make the one thing on the home page not quite true;
    and freezes do not reach the front of the chain, because whether the
    streak is alive is still "did you practise today or yesterday", or an
    account dormant for a fortnight would keep showing a live streak.
    """
    # `<` yesterday rather than "today or yesterday": a row is dated by the
    # clock that made it and today by the clock asking, so a run made in
    # Kolkata and read from New York can sit a day ahead of today. It was
    # still today for the person who spoke.
    if not days or days[0] < today - dt.timedelta(days=1):
        return 0, set()
    streak = 1
    spent: dict[tuple[int, int], int] = {}
    frozen: set[dt.date] = set()
    for earlier, later in zip(days[1:], days, strict=False):
        if streak >= rule.days:
            break
        if (later - earlier).days == 1:
            streak += 1
            continue
        if not (rule.freezes and _freeze(earlier, later, spent)):
            break
        frozen.update(earlier + dt.timedelta(days=n) for n in range(1, (later - earlier).days))
        streak += 1
    return streak, frozen


def _longest(days: list[dt.date], rule: Rule) -> int:
    """The best chain there has ever been under the same rule, so it can
    never come out shorter than the streak running today. The allowance
    resets per chain: two streaks a year apart did not compete for
    freezes. No "today" here; a chain in the past is as long as it was."""
    if not days:
        return 0
    best = run = 1
    spent: dict[tuple[int, int], int] = {}
    for earlier, later in zip(days[1:], days, strict=False):
        if (later - earlier).days == 1 or (rule.freezes and _freeze(earlier, later, spent)):
            run += 1
        else:
            run = 1
            spent = {}
        best = max(best, run)
    return min(best, rule.days)


def _today(offset_minutes: int, now: dt.datetime | None) -> dt.date:
    return local_date(now or dt.datetime.now(dt.UTC), offset_minutes)


def current_streak(did: str, offset_minutes: int = 0, user=None, rule: Rule = FREE, *, now=None) -> int:
    """Days practised in an unbroken chain ending today or yesterday, as
    far back as the rule tracks."""
    return _walk(local_dates(did, user), _today(offset_minutes, now), rule)[0]


def frozen_days(did: str, offset_minutes: int = 0, user=None, rule: Rule = FREE, *, now=None) -> set[dt.date]:
    """The days the freeze rule is holding open right now. Only the calendar
    wants these, so a Pro speaker whose streak survived can see which days
    it survived rather than take the number on trust. Empty under a rule
    with no freezes."""
    return _walk(local_dates(did, user), _today(offset_minutes, now), rule)[1]


def longest_streak(did: str, user=None, rule: Rule = FREE) -> int:
    return _longest(local_dates(did, user), rule)


@dataclass(frozen=True)
class Summary:
    """Everything a page says about somebody's practice, computed from one
    read of their days so no page can disagree with another. `would_be` is
    the streak under the longest Pro rule; equal to `streak` for Pro, and
    for everybody else the true thing the pitch may say: Pro would have
    held it at this."""

    streak: int
    longest: int
    topics: int
    minutes: int
    would_be: int
    frozen: set[dt.date] = field(default_factory=set)


def summary(did: str, offset_minutes: int = 0, user=None, rule: Rule = FREE, *, now=None) -> Summary:
    """Asked once per request and reused: the header pill, the done screen
    and the streak page all read this."""
    days = local_dates(did, user)
    today = _today(offset_minutes, now)
    streak, frozen = _walk(days, today, rule)
    would_be = streak if rule.freezes else _walk(days, today, pro_rule(PRO_DAYS_MAX))[0]
    topics, minutes = totals(did, user)
    return Summary(
        streak=streak, longest=_longest(days, rule), topics=topics, minutes=minutes, would_be=would_be, frozen=frozen
    )
