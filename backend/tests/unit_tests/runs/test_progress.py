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
    def test_two_rounds_are_a_before_and_an_after_and_that_is_the_whole_feature(self, db):
        # The owner's call, reversing a wait for five: an empty box arrives
        # exactly when somebody is deciding whether any of this is worth
        # having, and two rounds is the least that can be compared.
        rounds(2)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert shown.enough is True
        assert len(shown.points) == 2

    def test_one_round_is_a_report_and_not_yet_a_trend(self, db):
        rounds(1)
        shown = progress_of.progress(DEVICE, None, PRO)
        assert shown.enough is False
        assert shown.needed == 1
        assert shown.points == []


class TestTheWindowIsThePlans:
    def test_free_sees_five_days_and_a_plan_sees_its_own_length(self, db):
        rounds(4)
        Report.objects.update(created_at=dt.datetime.now(dt.UTC) - dt.timedelta(days=20))
        # Twenty days back is outside five and inside a year.
        assert progress_of.progress(DEVICE, None, streaks.FREE).counted == 0
        assert progress_of.progress(DEVICE, None, PRO).counted == 4


class TestTheTrendDoesNotLie:
    def test_a_round_nobody_transcribed_contributes_no_filler_rate(self, db):
        # A Whisper round has no honest filler count; counting its zero
        # would draw an improvement that never happened.
        for _ in range(4):
            run = RunFactory(spoken_seconds=60)
            Report.objects.create(run=run, segments=SPOKE, provider="groq", filler_rate=0.0)
        assert all(point.fillers is None for point in progress_of.progress(DEVICE, None, PRO).points)

    def test_a_short_history_is_never_averaged_into_a_shrug(self, db):
        # Smoothing exists to make many points readable, not to hide few.
        # With four rounds behind you, a real jump has to show as itself.
        rounds(3, stall=1.0)
        Report.objects.create(run=RunFactory(spoken_seconds=60), segments=SPOKE, opening_stall=10.0)
        assert progress_of.progress(DEVICE, None, PRO).points[-1].stall == 10.0

    def test_one_bad_round_stops_swinging_the_line_once_there_is_a_history(self, db):
        rounds(progress_of.SMOOTH_FROM, stall=1.0)
        Report.objects.create(run=RunFactory(spoken_seconds=60), segments=SPOKE, opening_stall=10.0)
        last = progress_of.progress(DEVICE, None, PRO).points[-1]
        # Now smoothed, so a ten-second outlier lands well short of ten and
        # the page does not announce a collapse.
        assert 1.0 < last.stall < 10.0

    def test_the_first_and_the_latest_minute_come_back_for_the_side_by_side(self, db):
        rounds(2)
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


def timed(text: str, gap: float = 0.4) -> list:
    out = []
    at = 0.0
    for token in text.split():
        out.append([token, round(at, 2), round(at + 0.3, 2)])
        at += gap
    return out


class TestTheSkillsOnEveryRound:
    def test_a_round_is_read_as_the_skills_a_learner_is_building(self, db):
        run = RunFactory(spoken_seconds=60, speak_seconds=60, prep_seconds=30, genre_slug="stories")
        said = "So I said, uh, I said we begin. We begin now."
        Report.objects.create(
            run=run,
            segments=[[2.0, 30.0], [33.0, 50.0]],
            provider=transcribe.ASSEMBLYAI,
            opening_stall=2.0,
            awkward_pauses=1,
            speaking_ratio=0.75,
            words=9,
            fillers=1,
            transcript=said,
            words_at=timed(said),
        )
        Report.objects.create(run=RunFactory(spoken_seconds=60), segments=SPOKE)
        one = progress_of.progress(DEVICE, None, PRO).rounds[0]
        assert (one.genre_slug, one.prep_seconds, one.setting, one.spoken) == ("stories", 30, 60, 60)
        # Silence is the round without its voice: sixty seconds at three
        # quarters speaking is fifteen quiet.
        assert one.silence == 15.0
        assert one.restarts == 1 and one.timed is True
        assert one.ended is True
        assert one.ums == 1
        assert one.distinct == 6  # so i said we begin now
        assert one.leaned == {"so": 1}

    def test_a_round_nothing_transcribed_has_the_timing_and_none_of_the_rest(self, db):
        rounds(2)
        one = progress_of.progress(DEVICE, None, PRO).rounds[0]
        assert one.ended is None and one.ums is None and one.distinct is None
        assert one.timed is False and one.leaned == {}

    def test_a_whisper_round_has_no_um_count_rather_than_a_clean_one(self, db):
        Report.objects.create(
            run=RunFactory(spoken_seconds=60), segments=SPOKE, provider="groq", words=5, transcript="we begin now"
        )
        rounds(1)
        assert progress_of.progress(DEVICE, None, PRO).rounds[0].ums is None


class TestFirsts:
    def test_the_first_round_that_met_each_milestone_is_the_one_named(self, db):
        base = dt.datetime(2026, 9, 1, 12, tzinfo=dt.UTC)
        first = RunFactory(spoken_seconds=40, speak_seconds=60)
        Report.objects.create(run=first, segments=[[5.0, 40.0]], opening_stall=5.0, awkward_pauses=2, created_at=base)
        second = RunFactory(spoken_seconds=60, speak_seconds=60)
        Report.objects.create(
            run=second,
            segments=[[1.0, 60.0]],
            opening_stall=1.0,
            awkward_pauses=0,
            created_at=base + dt.timedelta(days=1),
        )
        firsts = progress_of.progress(DEVICE, None, PRO, now=base + dt.timedelta(days=2)).firsts
        assert firsts["no_holes"].run_id == second.pk
        assert firsts["full_minute"].run_id == second.pk
        assert firsts["quick_start"].run_id == second.pk

    def test_a_milestone_nobody_could_have_failed_yet_is_not_yet_met(self, db):
        # No words carried a clock and nothing counted the ums, so a nought
        # in restarts or ums is uncounted, not clean.
        rounds(2)
        firsts = progress_of.progress(DEVICE, None, PRO).firsts
        assert firsts["no_restarts"] is None
        assert firsts["no_ums"] is None
        assert firsts["clean_ending"] is None


class TestWhoseProgressItIs:
    def test_an_account_spans_devices_and_a_stranger_only_sees_its_own(self, db, user):
        for _ in range(3):
            Report.objects.create(run=RunFactory(user=user, spoken_seconds=60), segments=SPOKE)
        assert progress_of.progress(DEVICE, user, PRO).counted == 3
        assert progress_of.progress(DEVICE, None, PRO).counted == 0
