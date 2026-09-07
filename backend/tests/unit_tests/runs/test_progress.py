"""Whether somebody is getting better is the thing Pro sells, so the ways
it could lie are what is pinned here: a line drawn through two points, a
Whisper zero counted as an improvement nobody made, and a window that
does not match the calendar beside it.
"""

import datetime as dt

import pytest

from apps.runs import progress as progress_of
from apps.runs import streaks, transcribe
from apps.runs.models import Report
from tests.unit_tests.factories import DEVICE, RunFactory

SPOKE = [(0.0, 55.0)]
AUDIO = b"not really audio"
PRO = streaks.pro_rule(365)


@pytest.fixture
def groq(settings):
    settings.GROQ_API_KEY = "test-key"
    gateway = transcribe.RecordingGateway()
    transcribe.use_gateway(gateway)
    yield gateway
    transcribe.use_gateway(None)


def rounds(how_many: int, *, stall: float = 1.0, gap: float = 1.0) -> None:
    for _ in range(how_many):
        run = RunFactory(spoken_seconds=60)
        Report.objects.create(run=run, segments=[[stall, 55.0]], opening_stall=stall, longest_pause=gap)


class TestEnough:
    def test_a_line_is_not_drawn_through_two_points(self, db):
        rounds(2)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert shown.enough is False
        assert shown.needed == progress_of.ENOUGH - 2
        assert shown.points == []

    def test_it_says_how_many_more_are_needed_which_is_the_reason_to_come_back(self, db):
        rounds(4)
        assert progress_of.progress(DEVICE, None, PRO).needed == 1

    def test_enough_rounds_draw_a_trend(self, db):
        rounds(progress_of.ENOUGH)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert shown.enough is True
        assert len(shown.points) == progress_of.ENOUGH
        assert shown.counted == progress_of.ENOUGH


class TestTheWindowIsThePlans:
    def test_free_sees_five_days_and_a_plan_sees_its_own_length(self, db):
        rounds(progress_of.ENOUGH)
        Report.objects.update(created_at=dt.datetime.now(dt.UTC) - dt.timedelta(days=20))
        # Twenty days back is outside five and inside a year.
        assert progress_of.progress(DEVICE, None, streaks.FREE).counted == 0
        assert progress_of.progress(DEVICE, None, PRO).counted == progress_of.ENOUGH


class TestTheTrendDoesNotLie:
    def test_a_round_nobody_transcribed_contributes_no_filler_rate(self, db):
        # A Whisper round has no honest filler count; counting its zero
        # would draw an improvement that never happened.
        for _ in range(progress_of.ENOUGH):
            run = RunFactory(spoken_seconds=60)
            Report.objects.create(run=run, segments=SPOKE, provider="groq", filler_rate=0.0)
        assert all(point.fillers is None for point in progress_of.progress(DEVICE, None, PRO).points)

    def test_one_bad_round_does_not_swing_the_line(self, db):
        rounds(progress_of.ENOUGH - 1, stall=1.0)
        run = RunFactory(spoken_seconds=60)
        Report.objects.create(run=run, segments=SPOKE, opening_stall=10.0)
        last = progress_of.progress(DEVICE, None, PRO).points[-1]
        # Smoothed over three, so a ten-second outlier lands well short of
        # ten and the page does not announce a collapse.
        assert 1.0 < last.stall < 10.0

    def test_the_first_and_the_latest_minute_come_back_for_the_side_by_side(self, db):
        rounds(progress_of.ENOUGH)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert shown.first is not None
        assert shown.latest is not None
        assert shown.first.at <= shown.latest.at
        assert shown.first.seconds == 60

    def test_only_the_newest_are_drawn_however_long_somebody_has_practised(self, db):
        rounds(progress_of.MOST + 6)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert len(shown.points) == progress_of.MOST
        # The count is the truth, even where the line is trimmed.
        assert shown.counted == progress_of.MOST + 6


class TestWhoseProgressItIs:
    def test_an_account_spans_devices_and_a_stranger_only_sees_its_own(self, db, user):
        for _ in range(progress_of.ENOUGH):
            Report.objects.create(run=RunFactory(user=user, spoken_seconds=60), segments=SPOKE)
        assert progress_of.progress(DEVICE, user, PRO).counted == progress_of.ENOUGH
        assert progress_of.progress(DEVICE, None, PRO).counted == 0
