"""The half of the report that costs money, and the ceiling on it.

Everything here is about spend, which is the one thing in this codebase
that fails silently and arrives as a bill. The allowance is counted in
minutes rather than rounds because the speak setting goes to ten of them,
and it is counted from rows rather than a column because a stored counter
drifts. Both are pinned below, along with the rule that a failed call
still spends: without it, a retry loop is free.
"""

import datetime as dt

import pytest

from apps.runs import reports, transcribe
from apps.runs.models import Report
from tests.unit_tests.factories import DEVICE, RunFactory

# Sound throughout a sixty-second round, which is what "heard" needs.
SPOKE = [(0.0, 55.0)]
AUDIO = b"not really audio"


@pytest.fixture
def groq(settings):
    settings.GROQ_API_KEY = "test-key"
    gateway = transcribe.RecordingGateway()
    transcribe.use_gateway(gateway)
    yield gateway
    transcribe.use_gateway(None)


class TestTheAllowanceIsMinutes:
    def test_a_ten_minute_round_spends_ten_times_a_one_minute_round(self, db, groq):
        reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        assert reports.used(DEVICE, None) == 60
        reports.make(RunFactory(spoken_seconds=600), [(0.0, 590.0)], audio=AUDIO)
        assert reports.used(DEVICE, None) == 660

    def test_free_stops_at_five_minutes_and_pro_at_two_hours(self, db, settings):
        settings.GROQ_API_KEY = "k"
        settings.ASSEMBLY_AI_API_KEY = "k"
        assert reports.left(DEVICE, None, pro=False) == reports.FREE_MINUTES * 60
        assert reports.left(DEVICE, None, pro=True) == reports.PRO_MINUTES * 60

    def test_spending_the_last_of_it_refuses_the_next_round_its_words(self, db, groq):
        # Five minutes in one go, so the next round has nothing left.
        reports.make(RunFactory(spoken_seconds=reports.FREE_MINUTES * 60), [(0.0, 290.0)], audio=AUDIO)
        assert reports.left(DEVICE, None, pro=False) == 0

        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        assert row.provider == ""
        assert row.transcript == ""
        # And it still got the half that costs nothing.
        assert row.opening_stall == 0.0
        assert row.speaking_ratio > 0

    def test_any_allowance_at_all_is_enough_to_start_so_a_round_is_never_cut_in_half(self, db, groq):
        reports.make(RunFactory(spoken_seconds=reports.FREE_MINUTES * 60 - 1), [(0.0, 290.0)], audio=AUDIO)
        assert reports.left(DEVICE, None, pro=False) == 1
        # One second left buys a whole ten-minute round, once.
        row = reports.make(RunFactory(spoken_seconds=600), [(0.0, 590.0)], audio=AUDIO)
        assert row.provider == transcribe.GROQ

    def test_last_month_does_not_count_against_this_one(self, db, groq):
        reports.make(RunFactory(spoken_seconds=200), SPOKE, audio=AUDIO)
        Report.objects.update(created_at=dt.datetime.now(dt.UTC) - dt.timedelta(days=40))
        assert reports.used(DEVICE, None) == 0


class TestWhatSpends:
    def test_a_failed_call_still_spends_or_a_retry_loop_is_free(self, db, groq):
        groq.error = transcribe.TranscribeError("provider is having a day")
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        assert row.provider == transcribe.GROQ
        assert row.transcript == ""
        assert reports.used(DEVICE, None) == 60

    def test_a_muted_microphone_never_reaches_a_provider(self, db, groq):
        row = reports.make(RunFactory(spoken_seconds=60), [(0.0, 1.0)], audio=AUDIO)
        assert groq.calls == []
        assert row.provider == ""
        assert reports.used(DEVICE, None) == 0

    def test_a_round_with_no_audio_is_a_timing_report_and_costs_nothing(self, db, groq):
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE)
        assert groq.calls == []
        assert row.provider == ""
        assert row.speaking_ratio > 0

    def test_a_report_never_raises_when_the_provider_is_not_configured(self, db):
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        assert row.provider == ""
        assert row.longest_pause == 0.0


class TestWhatIsStored:
    def test_the_inputs_are_kept_so_a_threshold_can_be_changed_later(self, db, groq):
        row = reports.make(RunFactory(spoken_seconds=60), [(1.0, 20.0), (23.0, 55.0)], audio=AUDIO)
        assert row.segments == [[1.0, 20.0], [23.0, 55.0]]
        assert row.transcript == groq.text

    def test_the_words_land_as_columns_a_trend_can_be_drawn_through(self, db, groq):
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        # "um so we should probably like begin"
        assert row.fillers == 1
        assert row.words == 6
        assert row.crutch_words == [["like", 1], ["so", 1]]
        assert row.pace > 0

    def test_pro_and_free_reach_different_providers(self, db, settings):
        settings.GROQ_API_KEY = "k"
        settings.ASSEMBLY_AI_API_KEY = "k"
        transcribe.use_gateway(transcribe.RecordingGateway(provider=transcribe.ASSEMBLYAI), pro=True)
        transcribe.use_gateway(transcribe.RecordingGateway(provider=transcribe.GROQ), pro=False)
        try:
            free = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
            paid = reports.make(RunFactory(spoken_seconds=60), SPOKE, pro=True, audio=AUDIO)
            assert free.provider == transcribe.GROQ
            assert paid.provider == transcribe.ASSEMBLYAI
        finally:
            transcribe.use_gateway(None)


class TestWhatIsReported:
    def test_a_transcript_of_punctuation_reports_no_pace_rather_than_nought(self, db, groq):
        groq.text = ". . ."
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        shown = reports.render(row)
        assert shown["words"] is None
        assert shown["pace"] is None

    def test_a_free_round_never_reports_a_filler_count(self, db, groq):
        # Whisper deletes them before anybody asks, so a zero would be an
        # undercount presented as a fact.
        row = reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        shown = reports.render(row)
        assert shown["words"] == 6
        assert shown["fillers"] is None


class TestWhoseAllowanceItIs:
    def test_an_account_spans_devices_and_a_stranger_only_sees_its_own(self, db, user, groq):
        reports.make(RunFactory(user=user, spoken_seconds=60), SPOKE, audio=AUDIO)
        reports.make(RunFactory(device_id="f" * 32, spoken_seconds=60), SPOKE, audio=AUDIO)
        assert reports.used(DEVICE, user) == 60
        assert reports.used("f" * 32, None) == 60
        assert reports.used(DEVICE, None) == 0


class TestTheBrowserClockIsChecked:
    """The browser measures the timeline and is not trusted with it:
    `analysis._clean` clips whatever runs past the round. Clipping in
    silence is how run 30 shipped a 58 second round with sound ending at
    226 seconds and nobody was told, so the overrun is now a line in the
    log."""

    def test_a_timeline_that_runs_past_the_round_is_logged_rather_than_clipped_in_silence(self, db, caplog):
        with caplog.at_level("WARNING", logger="apps.runs.reports"):
            reports.make(RunFactory(spoken_seconds=58), [(7.0, 226.42)])
        assert "overruns" in caplog.text

    def test_a_timeline_that_ends_a_beat_after_the_bell_is_not(self, db, caplog):
        with caplog.at_level("WARNING", logger="apps.runs.reports"):
            reports.make(RunFactory(spoken_seconds=58), [(2.0, 58.6)])
        assert "overruns" not in caplog.text


class TestAudioMustFitTheRoundItDescribes:
    """The one failure in this codebase that arrives as a bill.

    The allowance is charged `run.spoken_seconds`, which the browser
    reports, while the audio was bounded only in bytes - and bytes are not
    duration. Opus encodes speech at 6kbps, so the old twelve-megabyte
    ceiling was four and a half hours of audio charged as whatever the
    round said it was: a dollar twenty-six of AssemblyAI per request, and
    nine thousand a month against one lifetime account. Tying the bytes to
    the declared length is what closes it, because the length is also what
    is charged.
    """

    def test_four_hours_of_audio_on_a_one_second_round_never_reaches_a_provider(self, db, groq):
        run = RunFactory(spoken_seconds=1)
        reports.make(run, [(0.0, 1.0)], audio=b"x" * (12 * 1024 * 1024))
        assert groq.calls == []
        assert reports.used(DEVICE, None) == 0

    def test_a_real_ten_minute_round_at_the_browsers_own_bitrate_is_sent(self, db, groq):
        # Chrome records mono Opus at 128kbps, so ten minutes is 9.6MB.
        # The ceiling has to clear this or it costs somebody their report.
        run = RunFactory(spoken_seconds=600)
        reports.make(run, [(0.0, 590.0)], audio=b"x" * (96 * 100 * 1024))
        assert len(groq.calls) == 1

    def test_a_round_longer_than_any_the_site_offers_is_not_transcribed(self, db, groq):
        # The row allows two hours, the product allows ten minutes, and
        # AssemblyAI would bill the whole of an hour the poll then abandons.
        run = RunFactory(spoken_seconds=7200)
        reports.make(run, [(0.0, 7000.0)], audio=AUDIO)
        assert groq.calls == []

    def test_the_ceiling_is_asked_of_the_size_so_the_bytes_are_never_read(self, db):
        assert reports.may_send(RunFactory(spoken_seconds=60), 20 * 1024 * 1024) is False
        assert reports.may_send(RunFactory(spoken_seconds=60), 500 * 1024) is True


class TestTheAllowanceIsChargedForAudioAndNotForAClaim:
    """`spoken_seconds` is measured by the browser and posted by the
    browser, so charging it made the price of a transcription something
    the caller chose. Both providers report the duration they actually
    heard, and that is the number nobody on the other end picks."""

    def test_the_charge_is_what_the_provider_heard_not_what_the_round_claimed(self, db, settings):
        settings.GROQ_API_KEY = "k"
        # A round claiming one second, carrying twenty minutes of audio.
        transcribe.use_gateway(transcribe.RecordingGateway(seconds=1200.0))
        try:
            reports.make(RunFactory(spoken_seconds=1), [(0.0, 1.0)], audio=AUDIO)
            assert reports.used(DEVICE, None) == 1200
        finally:
            transcribe.use_gateway(None)

    def test_finishing_early_still_costs_the_round_it_was(self, db, groq):
        # The provider hears less than the round lasted, and the round is
        # what was booked. Never a refund for a short answer.
        groq.seconds = 12.0
        reports.make(RunFactory(spoken_seconds=60), SPOKE, audio=AUDIO)
        assert reports.used(DEVICE, None) == 60
