"""The chain and the grace day. The freeze rule and the longest streak
arrive with the streak rules card and their tests with them."""

import datetime as dt

from apps.runs.streaks import current_streak, local_dates
from tests.unit_tests import factories
from tests.unit_tests.factories import DEVICE, RunFactory, runs_on_days


def test_no_runs_is_zero_and_an_unknown_device_is_zero(db):
    RunFactory(device_id="e" * 32)
    assert current_streak(DEVICE) == 0


def test_consecutive_days_count_up_and_several_runs_in_one_day_count_once(db):
    runs_on_days([0, 0, 1, 1, 2])
    assert current_streak(DEVICE) == 3


def test_a_gap_ends_the_streak(db):
    runs_on_days([0, 1, 3, 4])
    assert current_streak(DEVICE) == 2


def test_a_streak_ending_yesterday_still_counts_but_two_days_ago_is_dead(db):
    runs_on_days([1, 2, 3])
    assert current_streak(DEVICE) == 3
    factories.Run.objects.all().delete()
    runs_on_days([2, 3])
    assert current_streak(DEVICE) == 0


def test_devices_do_not_share_streaks_and_an_account_spans_them(db, user):
    runs_on_days([0, 1])
    runs_on_days([0, 1, 2], device_id="e" * 32)
    assert current_streak(DEVICE) == 2
    RunFactory(user=user, device_id=DEVICE, days_ago=0)
    RunFactory(user=user, device_id="e" * 32, days_ago=1)
    assert current_streak("unused", user=user) == 2
    # A device that has not signed in sees only its unclaimed runs.
    assert current_streak(DEVICE) == 2


def test_each_run_is_dated_by_the_clock_that_made_it(db):
    """23:30 UTC on Monday is 05:00 Tuesday in Kolkata, and the row says
    so itself, so a person who travels keeps a true streak."""
    late = dt.datetime.now(dt.UTC).replace(hour=23, minute=30, second=0, microsecond=0) - dt.timedelta(days=2)
    RunFactory(base=late, tz_offset=330)
    assert local_dates(DEVICE) == [(late + dt.timedelta(minutes=330)).date()]


def test_today_is_the_requests_clock(db):
    """Somebody just west of midnight has not missed today."""
    now = dt.datetime(2026, 9, 8, 0, 30, tzinfo=dt.UTC)
    RunFactory(base=dt.datetime(2026, 9, 6, 20, 0, tzinfo=dt.UTC), tz_offset=-300)
    assert current_streak(DEVICE, offset_minutes=-300, now=now) == 1
    assert current_streak(DEVICE, offset_minutes=0, now=now) == 0
