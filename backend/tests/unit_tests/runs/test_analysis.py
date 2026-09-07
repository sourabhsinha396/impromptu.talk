"""The report is arithmetic, and arithmetic is exactly the kind of thing
that breaks silently. Every test here pins a decision rather than a
rendering: which silences count as pauses, what a dead microphone answers,
what pace is measured over, and which words are faults and which are
merely leaned on. No database, no clock, no network.
"""

import pytest

from apps.runs.analysis import (
    AWKWARD_PAUSE,
    CRUTCHES_NAMED,
    MIN_PAUSE,
    at_transitions,
    clock_seconds,
    read_back,
    report,
    timing,
    words,
)


class TestHearing:
    def test_a_muted_microphone_answers_nothing_heard_rather_than_a_minute_of_silence(self):
        assert timing([], 60).heard is False
        assert timing([(0.0, 1.0)], 60).heard is False

    def test_a_round_with_no_length_is_not_a_report(self):
        assert timing([(0.0, 30.0)], 0).heard is False

    def test_nothing_heard_carries_no_words_even_when_a_transcript_arrives(self):
        assert report([], 60, "a full sentence").words is None


class TestPauses:
    def test_a_gap_shorter_than_the_floor_is_articulation_and_not_a_pause(self):
        short = MIN_PAUSE / 2
        measured = timing([(0.0, 10.0), (10.0 + short, 60.0)], 60)
        assert measured.pauses == ()

    def test_a_long_gap_is_a_pause_and_a_longer_one_is_awkward(self):
        measured = timing([(0.0, 10.0), (11.0, 20.0), (20.0 + AWKWARD_PAUSE + 1, 60.0)], 60)
        assert [p.seconds for p in measured.pauses] == [1.0, AWKWARD_PAUSE + 1]
        assert [p.awkward for p in measured.pauses] == [False, True]
        assert measured.awkward_pauses == 1
        assert measured.longest_pause == AWKWARD_PAUSE + 1

    def test_the_silence_after_the_last_word_is_finishing_early_not_a_pause(self):
        measured = timing([(0.0, 20.0)], 60)
        assert measured.pauses == ()
        assert measured.longest_pause == 0.0

    def test_overlapping_segments_from_the_browser_are_merged_not_double_counted(self):
        measured = timing([(0.0, 30.0), (20.0, 40.0)], 60)
        assert measured.speaking_seconds == 40.0
        assert measured.pauses == ()

    def test_segments_arriving_out_of_order_or_past_the_clock_are_still_read(self):
        measured = timing([(30.0, 90.0), (0.0, 10.0)], 60)
        assert measured.speaking_seconds == 40.0
        assert measured.opening_stall == 0.0


class TestOpeningStall:
    def test_the_stall_is_the_silence_before_the_first_word(self):
        assert timing([(4.5, 60.0)], 60).opening_stall == 4.5

    def test_starting_at_once_is_no_stall(self):
        assert timing([(0.0, 60.0)], 60).opening_stall == 0.0


class TestTrailOff:
    def test_talking_throughout_is_steady(self):
        assert timing([(0.0, 60.0)], 60).trail_off == 1.0

    def test_going_quiet_at_the_end_reads_below_one(self):
        assert timing([(0.0, 50.0)], 60).trail_off < 1.0

    def test_a_late_sprint_reads_above_one(self):
        # Quiet for most of it, solid through the final fifth.
        assert timing([(0.0, 10.0), (48.0, 60.0)], 60).trail_off > 1.0


class TestWords:
    def test_no_transcript_is_no_word_report_rather_than_zeroes(self):
        assert words("", 60) is None
        assert words("   ", 60) is None

    def test_a_transcript_holding_no_words_is_the_same_as_none(self):
        # Groq answers a pure tone with ". . .", which is not a round of
        # nought words a minute; it is a round nobody counted.
        assert words(". . .", 60) is None
        assert words("...!?", 60) is None

    def test_fillers_are_counted_and_then_left_out_of_the_count_and_the_pace(self):
        measured = words("um so uh we begin", 60)
        assert measured.fillers == 2
        assert measured.count == 3
        assert measured.filler_rate == 2.0

    def test_pace_is_measured_over_the_clock_from_first_word_to_last(self):
        # Thirty words across thirty seconds of sound and fifteen of
        # silence between them is forty a minute, which is what a listener
        # heard. Sixty was the articulation rate, and it was being judged
        # against a wall-clock band, so nearly every round read as rushed.
        assert words(" ".join(["word"] * 30), 30, clock=45).pace == 40

    def test_without_a_clock_the_speaking_time_stands_in(self):
        assert words(" ".join(["word"] * 30), 30).pace == 60

    def test_the_silence_after_the_last_word_is_not_in_the_clock(self):
        measured = timing([(0.0, 10.0), (12.0, 22.0)], 60)
        assert clock_seconds(measured) == 22.0


class TestCrutchWords:
    def test_a_leaned_on_word_is_named_with_its_count(self):
        assert words("like like like we begin", 60).crutch_words == (("like", 3),)

    def test_only_the_top_few_are_named(self):
        transcript = "like like basically basically actually actually just just really really"
        assert len(words(transcript, 60).crutch_words) == CRUTCHES_NAMED

    def test_a_tie_is_broken_alphabetically_so_a_trend_never_wobbles(self):
        assert words("just really", 60).crutch_words == (("just", 1), ("really", 1))

    def test_an_ordinary_noun_is_never_called_a_crutch(self):
        assert words("chocolate chocolate chocolate", 60).crutch_words == ()

    def test_a_filler_is_never_reported_as_a_word_you_lean_on(self):
        measured = words("um um um", 60)
        assert measured.crutch_words == ()
        assert measured.fillers == 3


class TestReport:
    def test_one_call_returns_both_halves_and_the_words_are_optional(self):
        segments = [(1.0, 30.0), (32.0, 55.0)]
        full = report(segments, 60, "um we should probably like begin")
        assert full.timing.heard is True
        assert full.timing.opening_stall == 1.0
        assert full.words.fillers == 1
        assert full.words.crutch_words == (("like", 1),)

        free = report(segments, 60)
        assert free.timing == full.timing
        assert free.words is None


class TestReadBack:
    """The transcript with the silences put back where they fell, which is
    the one place a pause stops being a number and becomes the hole in the
    middle of your own sentence."""

    def spoke(self):
        # "I think ... it works", with a hole between the two halves.
        return [("I", 0.0, 0.2), ("think", 0.3, 0.7), ("it", 7.0, 7.2), ("works", 7.3, 7.8)]

    def test_a_silence_lands_between_the_words_it_interrupted(self):
        measured = timing([(0.0, 0.7), (7.0, 7.8)], 10)
        parts = read_back(self.spoke(), measured.pauses)
        kinds = [part.kind for part in parts]
        assert kinds == ["word", "word", "pause", "word", "word"]
        assert parts[2].seconds == pytest.approx(6.3, abs=0.05)
        assert parts[2].awkward is True

    def test_a_filler_is_named_where_it_was_said(self):
        parts = read_back([("um", 0.0, 0.3), ("right", 0.4, 0.8), ("tide", 0.9, 1.2)], ())
        assert [part.kind for part in parts] == ["filler", "crutch", "word"]

    def test_no_words_is_nothing_rather_than_a_row_of_silences(self):
        measured = timing([(0.0, 5.0), (8.0, 10.0)], 10)
        assert read_back([], measured.pauses) == ()


class TestAtTransitions:
    def test_an_um_beside_a_silence_is_counted_and_one_mid_sentence_is_not(self):
        measured = timing([(0.0, 5.0), (9.0, 12.0)], 12)
        # One um right after the hole, one early and far from it.
        beside = at_transitions([("um", 9.1, 9.4)], measured.pauses)
        inside = at_transitions([("um", 1.0, 1.3)], measured.pauses)
        assert beside == 1
        assert inside == 0

    def test_nothing_to_count_without_pauses_or_words(self):
        assert at_transitions([], ()) == 0
        assert at_transitions([("um", 1.0, 1.2)], ()) == 0
