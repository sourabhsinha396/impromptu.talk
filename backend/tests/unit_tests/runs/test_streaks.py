"""Streaks are derived, never stored, and that is only safe if the
derivation is right. Its edges are silent when broken: the grace day, the
offset, the plan's window, and the freeze rule, which is per calendar
month and so is tested on fixed dates rather than through rows dated
relative to a real today."""

import datetime as dt

import pytest

from apps.runs import streaks
from apps.runs.streaks import FREE, Rule, _freeze, current_streak, frozen_days, longest_streak, pro_rule, summary
from tests.unit_tests.factories import DEVICE, RunFactory, runs_on_days

PRO = pro_rule(365)


class TestCurrentStreak:
    def test_no_runs_and_an_unknown_device_are_zero(self, db):
        assert current_streak(DEVICE) == 0
        runs_on_days([0, 1])
        assert current_streak("e" * 32) == 0

    def test_consecutive_days_count_up_and_several_runs_in_one_day_count_once(self, db):
        runs_on_days([0, 0, 1, 1, 2, 3])
        assert current_streak(DEVICE) == 4

    def test_a_gap_ends_the_streak(self, db):
        runs_on_days([0, 1, 3, 4])
        assert current_streak(DEVICE) == 2

    def test_a_streak_ending_yesterday_still_counts_but_two_days_ago_is_dead(self, db):
        runs_on_days([1, 2, 3])
        assert current_streak(DEVICE) == 3
        runs_on_days([2, 3, 4], device_id="e" * 32)
        assert current_streak("e" * 32) == 0

    def test_devices_do_not_share_streaks_and_an_account_spans_them(self, db, user):
        runs_on_days([0, 1])
        RunFactory(user=user, device_id=DEVICE, days_ago=0)
        RunFactory(user=user, device_id="e" * 32, days_ago=1)
        assert current_streak(DEVICE) == 2
        assert current_streak("unused", user=user) == 2


class TestThePlanWindow:
    """Owner's call: free tracks five days and never reads above five; Pro
    tracks as many days as the plan lasts, a year at most."""

    def test_free_reads_at_most_five_days(self, db):
        runs_on_days(list(range(30)))
        assert current_streak(DEVICE) == 5
        assert current_streak(DEVICE, rule=FREE) == 5

    def test_a_monthly_plan_tracks_thirty_and_a_yearly_one_the_whole_chain(self, db):
        runs_on_days(list(range(40)))
        assert current_streak(DEVICE, rule=pro_rule(30)) == 30
        assert current_streak(DEVICE, rule=pro_rule(365)) == 40

    def test_lifetime_is_capped_at_a_year(self):
        assert pro_rule(10_000) == Rule(days=365, freezes=True)
        assert pro_rule(30) == Rule(days=30, freezes=True)
        assert FREE == Rule(days=5, freezes=False)

    def test_when_pro_lapses_the_free_rule_takes_over(self, db):
        runs_on_days([0, 2, 3, 4, 5, 6, 7, 8])
        assert current_streak(DEVICE, rule=pro_rule(30)) == 8
        assert current_streak(DEVICE) == 1


class TestTheClock:
    """The offset is minutes east of UTC, matching the browser's
    `-getTimezoneOffset()`. Each row is dated by the clock that made it and
    today by the clock asking."""

    def test_a_run_just_now_is_today_in_the_clock_that_made_it(self, db):
        for offset in (-720, -480, 0, 330, 720):
            RunFactory(base=dt.datetime.now(dt.UTC), device_id=f"{offset + 1000:032d}", tz_offset=offset)
            assert current_streak(f"{offset + 1000:032d}", offset_minutes=offset) == 1

    def test_a_run_read_from_a_clock_behind_the_one_that_made_it_is_still_alive(self, db):
        """Made at 01:00 Tuesday in Kolkata, read at 20:00 Monday in New
        York: the row sits a day ahead of today, and was still today for
        the person who spoke."""
        made = dt.datetime(2026, 9, 7, 19, 30, tzinfo=dt.UTC)
        RunFactory(base=made, tz_offset=330)
        assert current_streak(DEVICE, offset_minutes=-240, now=made + dt.timedelta(hours=5)) == 1

    def test_a_row_is_dated_by_its_own_clock(self, db):
        """23:30 UTC is 05:00 the next day in Kolkata, and the row says so
        itself, so a person who travels keeps a true streak."""
        late = dt.datetime(2026, 9, 6, 23, 30, tzinfo=dt.UTC)
        RunFactory(base=late, tz_offset=330)
        assert streaks.local_dates(DEVICE) == [dt.date(2026, 9, 7)]

    def test_today_is_the_requests_clock(self, db):
        """Somebody just west of midnight has not missed today."""
        now = dt.datetime(2026, 9, 8, 0, 30, tzinfo=dt.UTC)
        RunFactory(base=dt.datetime(2026, 9, 6, 20, 0, tzinfo=dt.UTC), tz_offset=-300)
        assert current_streak(DEVICE, offset_minutes=-300, now=now) == 1
        assert current_streak(DEVICE, offset_minutes=0, now=now) == 0


class TestFreezeRule:
    """The allowance itself, on fixed dates: a three-day gap is one month's
    worth mid-month and two months' worth across a boundary, so asserting
    it through rows dated from a real today would pass or fail with the
    calendar, the exact silent breakage this module is careful about."""

    def gap(self, first, second, spent=None):
        spent = {} if spent is None else spent
        return _freeze(dt.date.fromisoformat(first), dt.date.fromisoformat(second), spent), spent

    def test_one_missed_day_and_a_weekend_are_covered_and_billed_to_the_month(self):
        assert self.gap("2026-03-10", "2026-03-12") == (True, {(2026, 3): 1})
        assert self.gap("2026-03-06", "2026-03-09") == (True, {(2026, 3): 2})

    def test_three_days_in_one_month_is_not_and_a_refusal_spends_nothing(self):
        assert self.gap("2026-03-10", "2026-03-14") == (False, {})

    def test_the_allowance_is_per_month_not_per_streak_and_a_month_runs_out(self):
        _, spent = self.gap("2026-03-06", "2026-03-09")
        assert self.gap("2026-04-06", "2026-04-09", spent) == (True, {(2026, 3): 2, (2026, 4): 2})
        assert self.gap("2026-03-20", "2026-03-22", dict(spent))[0] is False

    def test_a_gap_across_a_month_boundary_bills_each_month(self):
        assert self.gap("2026-01-30", "2026-02-03") == (True, {(2026, 1): 1, (2026, 2): 2})

    def test_a_long_absence_is_refused_without_walking_it_and_adjacent_days_cost_nothing(self):
        assert self.gap("2025-01-01", "2026-01-01") == (False, {})
        assert self.gap("2026-03-10", "2026-03-11") == (True, {})


class TestFrozenStreaks:
    """The rule through the count. Only gaps whose verdict cannot move with
    the calendar are asserted: one and two missed days are covered
    whichever month they land in, five are refused whichever."""

    def test_free_breaks_on_a_missed_day_and_pro_survives_it(self, db):
        runs_on_days([0, 2, 3])
        assert current_streak(DEVICE) == 1
        assert current_streak(DEVICE, rule=PRO) == 3

    def test_a_frozen_day_does_not_count_as_a_day_spoken(self, db):
        runs_on_days([0, 2])
        assert current_streak(DEVICE, rule=PRO) == 2

    def test_pro_survives_a_weekend_but_not_a_week_away(self, db):
        runs_on_days([0, 3, 4])
        assert current_streak(DEVICE, rule=PRO) == 3
        runs_on_days([0, 6, 7], device_id="e" * 32)
        assert current_streak("e" * 32, rule=PRO) == 1

    def test_freezes_do_not_reach_the_front(self, db):
        runs_on_days([2, 3, 4])
        assert current_streak(DEVICE, rule=PRO) == 0

    def test_buying_pro_repairs_what_is_already_behind_you(self, db):
        runs_on_days([0, 2, 3, 4])
        assert current_streak(DEVICE) == 1
        assert current_streak(DEVICE, rule=PRO) == 4
        assert summary(DEVICE).would_be == 4

    def test_the_frozen_days_are_the_holes_the_count_bridged_and_free_holds_none(self, db):
        runs_on_days([0, 3, 4])
        today = streaks.local_dates(DEVICE)[0]
        assert frozen_days(DEVICE, rule=PRO) == {today - dt.timedelta(days=1), today - dt.timedelta(days=2)}
        assert frozen_days(DEVICE) == set()


class TestLongestStreak:
    def test_never_shorter_than_the_current_one_and_never_more_than_the_plan_tracks(self, db):
        runs_on_days([0, 1, 2, 3, 4, 5, 6, 10, 11])
        assert longest_streak(DEVICE, rule=PRO) == 7
        assert longest_streak(DEVICE) == 5
        assert longest_streak(DEVICE) >= current_streak(DEVICE)

    def test_a_dead_streak_still_counts_as_the_best(self, db):
        runs_on_days([5, 6, 7, 8])
        assert current_streak(DEVICE) == 0
        assert longest_streak(DEVICE) == 4

    def test_the_allowance_resets_per_chain(self, db):
        runs_on_days([0, 2, 3, 20, 22, 23])
        assert longest_streak(DEVICE, rule=PRO) == 3
        assert longest_streak(DEVICE) == 2


class TestSummary:
    def test_one_read_answers_every_page_the_same(self, db):
        runs_on_days([0, 2, 3])
        RunFactory(days_ago=0, spoken_seconds=125)
        shown = summary(DEVICE)
        assert (shown.streak, shown.longest, shown.topics, shown.minutes, shown.would_be) == (1, 2, 4, 5, 3)
        assert shown.streak == current_streak(DEVICE)
        assert shown.longest == longest_streak(DEVICE)

    def test_pro_would_be_is_the_streak_itself(self, db):
        runs_on_days([0, 2, 3])
        shown = summary(DEVICE, rule=PRO)
        assert (shown.streak, shown.would_be) == (3, 3)
        assert len(shown.frozen) == 1

    def test_nothing_is_all_zeros(self, db):
        assert summary(DEVICE) == streaks.Summary(0, 0, 0, 0, 0, set())


@pytest.mark.parametrize(
    ("cookie", "expected"),
    [("Asia%2FKolkata", 330), ("Asia/Kolkata", 330), ("", 0), ("Not/AZone", 0), ("Etc/UTC", 0)],
)
def test_the_timezone_cookie_becomes_todays_offset(cookie, expected):
    from apps.common.clock import offset_minutes

    assert offset_minutes(cookie, now=dt.datetime(2026, 9, 7, 12, tzinfo=dt.UTC)) == expected
