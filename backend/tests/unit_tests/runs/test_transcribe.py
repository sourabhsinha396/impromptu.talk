"""The seam to the transcribers, without a transcriber: what is asked for
and what is read back. Every real call is a bill, so `_post` is replaced
and nothing here reaches a network."""

from apps.runs import transcribe
from apps.runs.transcribe import GroqGateway, _multipart


class TestMultipart:
    def test_a_list_value_is_the_field_repeated(self):
        body, _ = _multipart({"timestamp_granularities[]": ["word", "segment"]}, "round.webm", b"x")
        assert body.count(b'name="timestamp_granularities[]"') == 2


class TestGroq:
    def test_asks_for_word_timings_and_reads_them_back_in_seconds(self, monkeypatch):
        sent = {}

        def fake_post(url, *, data, headers, method="POST"):
            sent["data"] = data
            return {
                "text": "we begin",
                "words": [{"word": "we", "start": 0.5, "end": 0.7}, {"word": "begin", "start": 0.8, "end": 1.2}],
            }

        monkeypatch.setattr(transcribe, "_post", fake_post)
        answer = GroqGateway("key").transcribe(b"audio", "round.webm")
        assert b"verbose_json" in sent["data"]
        assert b'name="timestamp_granularities[]"\r\n\r\nword\r\n' in sent["data"]
        assert answer.words == (("we", 0.5, 0.7), ("begin", 0.8, 1.2))
        assert answer.provider == transcribe.GROQ

    def test_a_word_with_no_timing_stays_in_the_text_and_off_the_clock(self, monkeypatch):
        monkeypatch.setattr(transcribe, "_post", lambda *a, **k: {"text": "we begin", "words": [{"word": "we"}]})
        answer = GroqGateway("key").transcribe(b"audio", "round.webm")
        assert answer.text == "we begin"
        assert answer.words == ()
