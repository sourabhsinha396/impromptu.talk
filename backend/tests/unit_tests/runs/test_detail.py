"""The round's own page. Everything on it is arithmetic over the transcript
and the word timings that were already stored, so what is pinned here is
the arithmetic: how the pace curve is bucketed, what counts as a restart
and what as a repeat, how a sentence is counted, and who gets a baseline.
"""

import pytest

from apps.runs import reports, transcribe
from apps.runs.analysis import (
    CRUTCHES_NAMED,
    RESTART_WITHIN,
    ended_clean,
    filler_counts,
    filler_times,
    leaned_on,
    pace_curve,
    repeats,
    restarts,
    sentences,
)
from tests.unit_tests.factories import RunFactory, midday


def timed(text: str, start: float = 0.0, gap: float = 0.4, each: float = 0.3) -> list[tuple[str, float, float]]:
    """Word timings for a sentence, one word every `gap` seconds."""
    out = []
    at = start
    for token in text.split():
        out.append((token, round(at, 2), round(at + each, 2)))
        at += gap
    return out


class TestPaceCurve:
    def test_each_ten_seconds_gets_its_own_pace(self):
        # Ten words in the first stretch, twenty in the second, none after.
        words = timed(" ".join(["a"] * 10), gap=1.0) + timed(" ".join(["b"] * 20), start=10.0, gap=0.5)
        curve = pace_curve(words, 30)
        assert [point.wpm for point in curve] == [60, 120, 0]
        assert (curve[0].start, curve[0].end) == (0.0, 10.0)

    def test_the_last_stretch_is_as_long_as_is_left(self):
        curve = pace_curve(timed("one two three"), 25)
        assert (curve[-1].start, curve[-1].end) == (20.0, 25.0)

    def test_fillers_are_not_words_here_either(self):
        assert pace_curve(timed("um um um um um word"), 10)[0].wpm == 6

    def test_nothing_timed_is_no_curve_rather_than_a_flat_one(self):
        assert pace_curve([], 60) == ()


class TestFillers:
    def test_each_filler_is_placed_where_it_was_said(self):
        assert [(f.word, f.at) for f in filler_times(timed("so um yes uh", gap=1.0))] == [("um", 1.0), ("uh", 3.0)]

    def test_every_filler_is_counted_by_its_own_name(self):
        assert filler_counts("um so uh um, uh um") == (("um", 3), ("uh", 2))

    def test_every_leaned_on_word_is_listed_and_not_just_the_top_few(self):
        listed = leaned_on("so like actually basically really just yeah honestly")
        assert len(listed) == 8 > CRUTCHES_NAMED


class TestRestarts:
    def test_a_sentence_begun_twice_within_a_few_seconds_is_a_restart(self):
        found = restarts(timed("and that I used, and that I used to fight"))
        assert [r.quote for r in found] == ["and that I used, and that"]
        assert found[0].at == 0.0

    def test_a_filler_between_the_two_tries_does_not_break_it(self):
        assert [r.quote for r in restarts(timed("I said, uh, I said I would"))] == ["I said, uh, I said"]

    def test_the_same_words_long_after_are_a_repeat_and_not_a_restart(self):
        words = timed("I think so") + timed("I think not", start=RESTART_WITHIN + 1)
        assert restarts(words) == ()

    def test_one_stumble_is_one_restart_however_many_pairs_it_holds(self):
        assert len(restarts(timed("and that I used, and that I used"))) == 1

    def test_a_sentence_said_again_after_a_full_stop_is_emphasis_and_not_a_stumble(self):
        assert restarts(timed("We begin. We begin now.")) == ()


class TestRepeats:
    def test_a_phrase_said_three_times_is_listed_once_in_its_longest_form(self):
        text = "Most of the time I won. Most of the time he lost. Most of the time it rained."
        assert repeats(text) == (("most of the time", 3),)

    def test_grammar_is_never_a_habit(self):
        assert repeats("one of the two of the three of the four") == ()

    def test_two_words_have_to_come_back_three_times_and_hold_no_function_word(self):
        assert repeats("pen fight then a pen fight") == ()
        assert repeats("pen fight, pen fight, pen fight") == (("pen fight", 3),)
        assert repeats("the pen. the pen. the pen.") == ()

    def test_a_phrase_never_crosses_a_full_stop(self):
        # "pen a red" would come back twice if the stops were ignored.
        assert repeats("a red pen. a red pen. a red pen.") == (("a red pen", 3),)

    def test_what_is_inside_a_restart_belongs_to_the_restart(self):
        assert repeats("and that I used, and that I used to fight", leave=("and that I used, and that",)) == ()


class TestSentences:
    def test_each_sentence_is_counted_without_its_fillers(self):
        found = sentences("A good pen is essential. Um, I remember, uh, the days.")
        assert [s.words for s in found] == [5, 4]
        assert found[1].text.startswith("Um,")

    def test_a_round_that_ends_on_a_full_stop_is_finished_and_one_that_trails_off_is_not(self):
        assert ended_clean("He lost most of the time.") is True
        assert ended_clean("and the world") is False
        assert ended_clean("") is False


# Sound throughout a sixty-second round, which is what "heard" needs.
SPOKE = [(0.0, 55.0)]
AUDIO = b"not really audio"
SAID = "So um I said, uh, I said we begin. We begin now."


@pytest.fixture
def assemblyai(settings):
    settings.ASSEMBLY_AI_API_KEY = "test-key"
    gateway = transcribe.RecordingGateway(provider=transcribe.ASSEMBLYAI, text=SAID, words=tuple(timed(SAID)))
    transcribe.use_gateway(gateway, pro=True)
    yield gateway
    transcribe.use_gateway(None)


@pytest.fixture
def groq(settings):
    settings.GROQ_API_KEY = "test-key"
    # Whisper hands back the words with their clock and without the ums.
    heard = "So I said, I said we begin. We begin now."
    gateway = transcribe.RecordingGateway(provider=transcribe.GROQ, text=heard, words=tuple(timed(heard)))
    transcribe.use_gateway(gateway, pro=False)
    yield gateway
    transcribe.use_gateway(None)


class TestTheRoundsOwnPage:
    def test_the_page_gets_the_curve_the_fillers_the_restart_and_the_sentences(self, db, assemblyai):
        row = reports.make(RunFactory(), SPOKE, pro=True, audio=AUDIO)
        shown = reports.render(row, pro=True)
        assert shown["pace_curve"][0]["wpm"] > 0
        assert [f["word"] for f in shown["filler_times"]] == ["um", "uh"]
        assert shown["filler_counts"] == [{"word": "uh", "count": 1}, {"word": "um", "count": 1}]
        assert [r["quote"] for r in shown["restarts"]] == ["I said, uh, I said"]
        assert [s["words"] for s in shown["sentences"]] == [7, 3]
        assert shown["ended_clean"] is True
        # The read-back carries the clock, so a page can find the word a
        # restart began on.
        assert shown["said"][0]["at"] == 0.0

    def test_a_free_round_says_nothing_about_fillers_and_keeps_everything_timed(self, db, groq):
        row = reports.make(RunFactory(), SPOKE, pro=False, audio=AUDIO)
        shown = reports.render(row, pro=False)
        assert shown["filler_times"] == [] and shown["filler_counts"] == []
        assert shown["pace_curve"][0]["wpm"] > 0
        assert [r["quote"] for r in shown["restarts"]] == ["I said, I said"]
        assert shown["usual"] is None

    def test_pace_is_read_by_the_clock_whenever_the_round_was_made(self, db, assemblyai):
        # Fifteen words over ten seconds of sound with a five-second hole in
        # the middle: sixty a minute by the clock, ninety over speaking time.
        run = RunFactory()
        row = reports.make(run, [(0.0, 5.0), (10.0, 15.0)], pro=True, audio=AUDIO)
        assemblyai.text = " ".join(["word"] * 15)
        row.transcript = assemblyai.text
        row.words = 15
        row.pace = 90
        row.save()
        assert reports.render(row, pro=True)["pace"] == 60


class TestYourUsual:
    def test_pro_gets_the_mean_of_the_rounds_before_this_one(self, db, assemblyai):
        base = midday()
        for days in (3, 2, 1):
            reports.make(RunFactory(days_ago=days, base=base), SPOKE, pro=True, audio=AUDIO)
        today = reports.make(RunFactory(base=base), SPOKE, pro=True, audio=AUDIO)
        shown = reports.usual(today, pro=True)
        assert shown["rounds"] == 3
        # Every round said the same words the same way, so the mean is the
        # value, and the baseline reads by the same rule as the round.
        assert shown["pace"] == reports.render(today, pro=True)["pace"]
        assert shown["sentence"] == 7
        assert shown["stall"] == 0.0

    def test_free_has_no_usual(self, db, groq):
        base = midday()
        for days in (2, 1):
            reports.make(RunFactory(days_ago=days, base=base), SPOKE, audio=AUDIO)
        today = reports.make(RunFactory(base=base), SPOKE, audio=AUDIO)
        assert reports.usual(today, pro=False) is None

    def test_one_round_behind_you_is_a_previous_round_and_not_a_usual(self, db, assemblyai):
        base = midday()
        reports.make(RunFactory(days_ago=1, base=base), SPOKE, pro=True, audio=AUDIO)
        today = reports.make(RunFactory(base=base), SPOKE, pro=True, audio=AUDIO)
        assert reports.usual(today, pro=True) is None

    def test_rounds_after_this_one_are_not_in_its_usual(self, db, assemblyai):
        base = midday()
        first = reports.make(RunFactory(days_ago=2, base=base), SPOKE, pro=True, audio=AUDIO)
        for days in (1, 0):
            reports.make(RunFactory(days_ago=days, base=base), SPOKE, pro=True, audio=AUDIO)
        assert reports.usual(first, pro=True) is None
