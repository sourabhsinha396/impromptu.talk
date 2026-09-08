"""`POST /api/v1/runs/{id}/report`, the report on a round.

Its own call rather than folded into the run, so a transcriber having a
slow day costs somebody their report and never their streak. What is
tested here is the boundary rather than the arithmetic, which
`test_analysis.py` and `test_reports.py` already hold: whose run it is,
what a second report does, and that a stranger still gets the half that
costs nothing.
"""

import json

import pytest
from django.test import Client

from apps.runs import transcribe
from apps.runs.models import Report, Run

RUNS = "/api/v1/runs"
SPOKE = json.dumps([[1.0, 55.0]])


@pytest.fixture
def groq(settings):
    settings.GROQ_API_KEY = "test-key"
    gateway = transcribe.RecordingGateway()
    transcribe.use_gateway(gateway)
    yield gateway
    transcribe.use_gateway(None)


def a_run(client) -> int:
    body = {
        "topic_text": "Low tide",
        "genre_slug": "general",
        "prep_seconds": 60,
        "speak_seconds": 60,
        "spoken_seconds": 60,
    }
    client.post(RUNS, body, content_type="application/json")
    return Run.objects.latest("id").pk


def test_a_stranger_gets_the_timing_half_with_no_audio_and_no_account(client, db):
    run_id = a_run(client)
    answer = client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE})
    assert answer.status_code == 200

    body = answer.json()
    assert body["heard"] is True
    assert body["opening_stall"] == 1.0
    # Nothing transcribed it, so the words are absent rather than zero.
    assert body["words"] is None
    assert body["fillers"] is None


def test_audio_is_transcribed_and_the_words_arrive(client, db, groq):
    run_id = a_run(client)
    body = client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE, "audio": _clip()}).json()
    assert groq.calls
    assert body["words"] == 6
    assert body["crutch_words"] == [{"word": "like", "count": 1}, {"word": "so", "count": 1}]
    # Groq is Whisper and deletes fillers, so a count from it is withheld
    # rather than reported as zero.
    assert body["fillers"] is None
    assert body["seconds_left"] == 4 * 60


def test_another_device_cannot_attach_a_report_to_a_run_it_does_not_own(client, db):
    run_id = a_run(client)
    stranger = Client()
    answer = stranger.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE})
    # 404 rather than 403: whether a run id exists is not their business.
    assert answer.status_code == 404
    assert Report.objects.count() == 0


def test_a_run_gets_one_report_and_a_second_post_is_refused(client, db, groq):
    run_id = a_run(client)
    assert client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE, "audio": _clip()}).status_code == 200
    assert client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE, "audio": _clip()}).status_code == 404
    # And the second attempt never reached a provider, so it spent nothing.
    assert len(groq.calls) == 1


def test_a_run_that_never_existed_is_a_404(client, db):
    assert client.post(f"{RUNS}/999999/report", {"segments": SPOKE}).status_code == 404


def test_a_timeline_no_browser_could_have_made_is_survived(client, db):
    run_id = a_run(client)
    answer = client.post(f"{RUNS}/{run_id}/report", {"segments": "not json at all"})
    assert answer.status_code == 200
    # No timeline means nothing was heard, which is the muted-microphone
    # answer and not a 500.
    assert answer.json()["heard"] is False


def _clip():
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile("round.webm", b"not really audio", content_type="audio/webm")


class TestReadingOneBack:
    """A round's report was drawn once and then gone, while Pro was sold on
    keeping it. These pin that it comes back, and only to whoever made it."""

    def test_a_past_round_can_be_opened_again(self, client, db, groq):
        run_id = a_run(client)
        made = client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE, "audio": _clip()}).json()
        again = client.get(f"{RUNS}/{run_id}/report")
        assert again.status_code == 200
        assert again.json()["said"] == made["said"]
        assert again.json()["opening_stall"] == made["opening_stall"]
        assert again.headers["Cache-Control"] == "private, no-store"

    def test_a_round_with_no_report_is_a_404_rather_than_an_empty_one(self, client, db):
        run_id = a_run(client)
        assert client.get(f"{RUNS}/{run_id}/report").status_code == 404

    def test_another_device_cannot_read_a_report_it_did_not_make(self, client, db, groq):
        run_id = a_run(client)
        client.post(f"{RUNS}/{run_id}/report", {"segments": SPOKE, "audio": _clip()})
        assert Client().get(f"{RUNS}/{run_id}/report").status_code == 404

    def test_the_recent_list_says_which_rounds_have_one_to_open(self, client, db, groq):
        first = a_run(client)
        client.post(f"{RUNS}/{first}/report", {"segments": SPOKE, "audio": _clip()})
        a_run(client)
        rows = client.get(f"{RUNS}/history").json()["recent"]
        assert [row["has_report"] for row in rows] == [False, True]
        assert rows[1]["id"] == first


class TestWhatStandsInFrontOfTheBill:
    """This is the one route that spends money, and both things guarding
    it are the kind that break silently: a decorator dropped in a rebase,
    and a body no browser sends."""

    def test_the_paid_route_is_keyed_on_the_address_as_well_as_the_device(self):
        from apps.runs.apis import attach_report

        # A device id is a cookie this server mints on demand, so the
        # device bucket resets for any client that stops sending one. The
        # address bucket is the one that cannot be minted.
        assert [mark["name"] for mark in attach_report.throttles] == ["reports-address", "reports"]

    def test_more_segments_than_a_round_could_hold_are_refused_like_any_other_bad_body(self, client, db):
        run_id = a_run(client)
        flood = json.dumps([[0.0, 0.1]] * 200_000)
        answer = client.post(f"{RUNS}/{run_id}/report", {"segments": flood})
        assert answer.status_code == 200
        # Refused, not truncated: the timeline is stored on the row and
        # re-read on every render, so a bad one is slow forever after.
        assert answer.json()["heard"] is False
        assert Report.objects.get(run_id=run_id).segments == []
