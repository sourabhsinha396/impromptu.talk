"""Return rate is the number the roadmap waits on, which makes the two
ways it lies worth testing: counting someone as churn before their window
has elapsed, and a cohort of one reading as 100%."""

import datetime as dt
from io import StringIO

from django.core.management import call_command

from apps.runs.retention import cohort_return, report, returned_within
from tests.unit_tests.factories import RunFactory, runs_on_days


def test_no_runs_is_an_empty_cohort_that_says_so(db):
    result = cohort_return(1)
    assert (result.devices, result.rate) == (0, 0.0)
    assert "no cohort old enough yet" in str(result)


def test_day_two_return_across_a_mixed_cohort_counts_people_not_enthusiasm(db):
    runs_on_days([5, 4], device_id="r" * 32)
    runs_on_days([5, 5, 4, 4], device_id="s" * 32)
    for name in "abc":
        RunFactory(days_ago=5, device_id=name * 32)
    result = cohort_return(1)
    assert (result.devices, result.returned) == (5, 2)
    assert result.rate == 0.4


def test_someone_who_arrived_today_is_not_yet_churn(db):
    runs_on_days([4, 3], device_id="r" * 32)
    RunFactory(days_ago=0, device_id="n" * 32)
    result = cohort_return(1)
    assert (result.devices, result.returned) == (1, 1)
    assert cohort_return(6).devices == 0


def test_exact_day_scores_an_irregular_returner_as_churn_and_within_counts_them(db):
    runs_on_days([9, 6], device_id="i" * 32)
    runs_on_days([20, 2], device_id="l" * 32)
    assert cohort_return(1).returned == 0
    result = returned_within(7)
    assert (result.devices, result.returned) == (2, 1)


def test_days_are_bucketed_in_utc_whatever_the_rows_clock_says(db):
    base = dt.datetime.now(dt.UTC).replace(hour=23, minute=30, second=0, microsecond=0) - dt.timedelta(days=4)
    RunFactory(base=base, device_id="n" * 32, tz_offset=330)
    RunFactory(base=base + dt.timedelta(hours=1), device_id="n" * 32, tz_offset=330)
    assert cohort_return(1).returned == 1


def test_the_command_prints_the_gate_in_four_lines(db):
    runs_on_days([3, 2], device_id="d" * 32)
    out = StringIO()
    call_command("retention_report", stdout=out)
    text = out.getvalue()
    assert text == report() + "\n"
    assert "devices: 1   runs: 2" in text
    assert "day-2 return: 100.0% (1/1 devices)" in text
    assert "day-7 return: no cohort old enough yet" in text
    assert "within 7 days" in text
