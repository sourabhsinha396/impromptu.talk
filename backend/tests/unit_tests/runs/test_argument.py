"""The one part of a report a model writes, and the shapes it is refused.

Nothing here reaches a provider: every test runs against
`openrouter.RecordingGateway` and the testing settings blank the key on
top of that. What is pinned hardest is not the prompt but the refusals,
because a model that answers in nearly the right shape is the way a report
starts contradicting itself, and a report that argues with itself makes
every other number on the page worth less.
"""

import json

import pytest
from django.test import override_settings

from apps.common import openrouter
from apps.runs import analysis, argument, progress, reports, transcribe
from tests.unit_tests.factories import DEVICE, RunFactory

ON = override_settings(OPENROUTER_API_KEY="sk-test", OPENROUTER_MODEL="test/model")

# Run 30, the round this feature exists for: the topic asked for an
# argument and got a story. The digit in the fourth sentence is there on
# purpose - it is the token that used to walk every later span down the
# round by one word.
TOPIC = "Argue for owning one good pen"
TRANSCRIPT = (
    "A good pen is very essential for a pen fight. "
    "I remember the days when I used to play pen fight with my friend. "
    "And then his target became to defeat me using a 2 rupee penny. "
    "He was also very good with it, but eventually he lost most of the time."
)
ANSWER = {
    "answered": "half",
    "roles": ["point", "example", "example", "example"],
    "verdict": "You said a good pen matters, then told the story and never came back to owning one.",
    "next": "After the story, come back. One sentence on why one good pen is worth owning.",
}

SPOKE = [(0.0, 55.0)]
AUDIO = b"not really audio"


def timed(transcript: str, start: float = 2.0, step: float = 0.4) -> tuple:
    """Word timings the way a transcriber hands them over: every token of
    the same transcript, in order, on a steady clock."""
    out = []
    for index, word in enumerate(transcript.split()):
        at = start + index * step
        out.append((word, round(at, 2), round(at + step * 0.8, 2)))
    return tuple(out)


def said(answer: dict | str) -> str:
    return answer if isinstance(answer, str) else json.dumps(answer)


@pytest.fixture
def model():
    recorded = openrouter.RecordingGateway(text=said(ANSWER))
    openrouter.use_gateway(recorded)
    with ON:
        yield recorded
    openrouter.use_gateway(None)


@pytest.fixture
def transcriber():
    """AssemblyAI's seat, which is the one Pro rounds use."""
    gateway = transcribe.RecordingGateway(
        text=TRANSCRIPT, provider=transcribe.ASSEMBLYAI, words=timed(TRANSCRIPT)
    )
    transcribe.use_gateway(gateway)
    yield gateway
    transcribe.use_gateway(None)


@pytest.fixture
def keys(settings):
    settings.ASSEMBLY_AI_API_KEY = "k"
    settings.GROQ_API_KEY = "k"


def sentences(transcript: str = TRANSCRIPT):
    return analysis.sentences(transcript)


class TestTheShapesItTakes:
    def test_the_answer_becomes_a_role_for_every_sentence(self):
        case = argument.parse(said(ANSWER), 4)
        assert case is not None
        assert case.answered == "half"
        assert case.roles == ("point", "example", "example", "example")
        assert case.verdict.startswith("You said a good pen")

    def test_a_model_that_fences_its_json_is_still_understood(self):
        """It adds fences however firmly it is asked not to, exactly as it
        adds list markers to twenty topics."""
        fenced = f"Here you go:\n```json\n{said(ANSWER)}\n```\nHope that helps."
        assert argument.parse(fenced, 4) is not None


class TestTheShapesItRefuses:
    def test_a_role_for_only_some_of_the_sentences_is_refused_whole(self):
        """A tail with no role would need a seventh colour on the page
        meaning "the model stopped", and every count under it would be
        short by the same amount."""
        short = ANSWER | {"roles": ["point", "example"]}
        assert argument.parse(said(short), 4) is None

    def test_a_word_that_is_not_one_of_the_six_roles_is_refused(self):
        made_up = ANSWER | {"roles": ["thesis", "example", "example", "example"]}
        assert argument.parse(said(made_up), 4) is None

    def test_missed_it_over_a_sentence_drawn_as_the_point_is_refused(self):
        """The report arguing with itself, which is the one thing that
        makes every other number on the page worth less."""
        both = ANSWER | {"answered": "no"}
        assert argument.parse(said(both), 4) is None
        # And the same answer without a point is taken.
        alone = ANSWER | {"answered": "no", "roles": ["setup", "aside", "aside", "close"]}
        assert argument.parse(said(alone), 4) is not None

    def test_a_paragraph_is_refused_rather_than_cut_in_half(self):
        """The report writes no prose. A cap that truncated would leave
        somebody half a sentence and call it advice."""
        essay = ANSWER | {"next": " ".join(["word"] * (argument.MOST_WORDS + 1))}
        assert argument.parse(said(essay), 4) is None

    def test_a_score_out_of_ten_is_not_a_verdict(self):
        assert argument.parse(said(ANSWER | {"answered": "7/10"}), 4) is None

    def test_nothing_that_is_not_json_survives(self):
        for text in ["", "I am afraid I cannot help with that.", "[]", "{"]:
            assert argument.parse(text, 4) is None


class TestWhoGetsRead:
    def test_a_pro_round_is_read_once_and_stored_on_the_row(self, db, keys, model, transcriber):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        assert row.answered == "half"
        assert row.roles == ["point", "example", "example", "example"]
        assert row.read_back is True
        assert len(model.calls) == 1

    def test_the_topic_and_the_delivery_go_into_the_prompt(self, db, keys, model, transcriber):
        """Fed the numbers the page draws beside it, so it cannot praise an
        ending the bell cut off."""
        reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        asked = model.calls[0]["prompt"]
        assert TOPIC in asked
        assert "1. A good pen is very essential for a pen fight." in asked
        assert "finished on a full stop" in asked

    def test_a_free_round_is_never_read(self, db, keys, model):
        """Free keeps the whole delivery report and none of this. The call
        needs a transcript, and Pro is what buys one that keeps its
        fillers."""
        gateway = transcribe.RecordingGateway(text=TRANSCRIPT, provider=transcribe.GROQ, words=timed(TRANSCRIPT))
        transcribe.use_gateway(gateway)
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=False, audio=AUDIO)
        transcribe.use_gateway(None)
        assert row.transcript
        assert row.answered == ""
        assert model.calls == []

    def test_a_round_nobody_transcribed_is_never_read(self, db, keys, model):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=None)
        assert row.transcript == ""
        assert model.calls == []

    def test_without_a_key_the_report_is_whole_and_nothing_is_asked(self, db, keys, transcriber):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        assert row.transcript
        assert row.answered == ""


class TestAModelHavingADayCostsTheSectionAndNothingElse:
    def test_a_refusal_leaves_the_report_whole(self, db, keys, model, transcriber):
        model.error = openrouter.ModelError("the model could not be reached (503)")
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        assert row.pk is not None
        assert row.transcript == TRANSCRIPT
        assert row.words > 0
        assert row.read_back is False

    def test_an_answer_in_the_wrong_shape_leaves_the_report_whole(self, db, keys, model, transcriber):
        model.text = "Sorry, I can't do that."
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        assert row.words > 0
        assert row.read_back is False


class TestWhereEachSentenceSatOnTheClock:
    def test_a_token_with_no_letters_does_not_walk_the_spans_down_the_round(self):
        """"a 2 rupee penny": `sentences` does not count the digit, so the
        word clock must not either, or every later sentence drifts."""
        spans = analysis.sentence_spans(list(timed(TRANSCRIPT)), sentences())
        assert len(spans) == 4
        assert all(span is not None for span in spans)
        # In order, and the last one ends where the words do.
        starts = [span.start for span in spans]
        assert starts == sorted(starts)
        assert spans[-1].end == pytest.approx(timed(TRANSCRIPT)[-1][2])

    def test_the_first_sentence_starts_at_the_first_word(self):
        spans = analysis.sentence_spans(list(timed(TRANSCRIPT, start=2.13)), sentences())
        assert spans[0].start == pytest.approx(2.13)

    def test_a_round_with_no_word_clock_places_nothing(self):
        assert analysis.sentence_spans([], sentences()) == (None, None, None, None)


class TestWhatThePageIsHandedBack:
    def test_the_round_carries_its_case_and_a_role_on_every_sentence(self, db, keys, model, transcriber):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        drawn = reports.render(row, pro=True)
        assert drawn["case"]["answered"] == "half"
        assert drawn["case"]["advice"].startswith("After the story")
        roles = [sentence["role"] for sentence in drawn["sentences"]]
        assert roles == ["point", "example", "example", "example"]
        assert drawn["sentences"][0]["at"] == pytest.approx(2.0)

    def test_a_round_nothing_read_says_so_rather_than_drawing_an_empty_section(self, db, keys, transcriber):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        drawn = reports.render(row, pro=True)
        assert drawn["case"] is None
        assert [sentence["role"] for sentence in drawn["sentences"]] == ["", "", "", ""]
        # And the spans are there anyway: they are arithmetic, not a
        # judgement, so a free round draws its sentences on the clock too.
        assert drawn["sentences"][0]["at"] is not None

    def test_a_lapsed_plan_keeps_the_judgement_it_earned(self, db, keys, model, transcriber):
        row = reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        assert reports.render(row, pro=False)["case"]["answered"] == "half"


class TestWhetherItIsGettingBetter:
    """The case as a trend, which is the question the progress page is for.
    Both fields are arithmetic over what the round already stored."""

    def test_every_round_carries_whether_it_was_answered_and_when_the_point_landed(
        self, db, keys, model, transcriber
    ):
        for _ in range(2):
            reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        rounds = progress.progress(DEVICE).rounds
        assert [one.answered for one in rounds] == ["half", "half"]
        assert all(one.point_at == pytest.approx(2.0) for one in rounds)

    def test_a_round_that_made_no_point_has_no_time_rather_than_nought(self, db, keys, model, transcriber):
        model.text = said(ANSWER | {"answered": "no", "roles": ["setup", "aside", "aside", "close"]})
        reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        reports.make(RunFactory(topic_text=TOPIC), SPOKE, pro=True, audio=AUDIO)
        rounds = progress.progress(DEVICE).rounds
        assert [one.answered for one in rounds] == ["no", "no"]
        assert [one.point_at for one in rounds] == [None, None]


class TestTheTranscriptCannotGrowThePromptWithoutABound:
    """The prompt carries a line per sentence and the answer a role per
    sentence, and only the answer had a ceiling. A transcript long enough
    walks the prompt up while `MAX_TOKENS` truncates the array, so `parse`
    refuses the shape and the input tokens are paid for and binned - the
    failure gets quieter the more it costs."""

    def test_more_sentences_than_a_round_could_hold_never_reaches_the_model(self, model):
        said = sentences("This is a sentence. " * (argument.MOST_SENTENCES + 1))
        delivery = argument.Delivery(stall=1.0, pace=140, longest_pause=0.5, ended_clean=True)
        assert argument.read(TOPIC, said, delivery) is None
        assert model.calls == []
