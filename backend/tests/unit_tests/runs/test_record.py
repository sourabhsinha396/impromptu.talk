"""`POST /api/v1/runs`, the one write the round makes.

It has to work for a visitor with no account and no prior state, identify
them well enough to keep a streak, and refuse nonsense without a 500.
"""

import pytest
from django.test import Client

from apps.common.devices import DEVICE_COOKIE
from apps.runs.apis import record
from apps.runs.models import Run

RUNS = "/api/v1/runs"


def payload(**over) -> dict:
    body = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60}
    body.update({"spoken_seconds": 60, **over})
    return body


def post(client, **over):
    return client.post(RUNS, payload(**over), content_type="application/json")


def test_a_stranger_records_a_run_and_gets_the_scoreboard(client, db):
    response = post(client)
    assert response.status_code == 200
    row = Run.objects.get()
    # The id rides along so the browser can attach a report to the round it
    # just finished; the pill's own answer never carries one.
    assert response.json() == {"id": row.pk, "streak": 1, "topics": 1, "minutes": 1}
    assert DEVICE_COOKIE in response.cookies
    assert (row.genre_slug, row.spoken_seconds, row.user) == ("general", 60, None)
    assert len(row.device_id) == 32


def test_finishing_early_and_skipping_prep_are_recorded_not_rejected(client, db):
    assert post(client, prep_seconds=0, speak_seconds=60, spoken_seconds=11).status_code == 200
    row = Run.objects.get()
    assert (row.prep_seconds, row.speak_seconds, row.spoken_seconds) == (0, 60, 11)


def test_a_topic_no_longer_in_the_bank_is_still_a_run(client, db):
    """A retired or renamed topic must not cost someone their streak; the
    text is the record and nothing is looked up."""
    assert post(client, topic_text="A line we removed", genre_slug="a-genre-we-merged").status_code == 200


@pytest.mark.parametrize(
    "bad",
    [
        {"topic_text": ""},
        {"topic_text": "x" * 201},
        {"spoken_seconds": -1},
        {"speak_seconds": 7201},
        {"tz_offset": 901},
        {"genre_slug": ""},
    ],
)
def test_a_value_no_person_could_have_produced_is_refused_at_the_edge(client, db, bad):
    assert post(client, **bad).status_code == 422
    assert Run.objects.count() == 0


def test_runs_add_up_for_one_device_and_devices_are_isolated(client, db):
    post(client)
    post(client, spoken_seconds=120)
    told = post(client).json()
    assert {key: told[key] for key in ("streak", "topics", "minutes")} == {"streak": 1, "topics": 3, "minutes": 4}
    assert post(Client()).json()["topics"] == 1


def test_a_signed_in_run_is_the_accounts_and_counts_across_devices(auth_client, user, db):
    post(auth_client)
    other = Client()
    other.force_login(user)
    assert post(other).json()["topics"] == 2
    assert Run.objects.filter(user=user).count() == 2


def test_the_limit_is_per_device_not_per_address(client, db):
    """A classroom behind one address is many speakers."""
    assert record.throttles == [{"name": "runs", "rate": "120/hour"}]
    for _ in range(120):
        assert post(client).status_code == 200
    refused = post(client)
    assert refused.status_code == 429
    assert int(refused["Retry-After"]) >= 1
    assert post(Client()).status_code == 200


def test_the_header_reads_the_same_numbers_the_round_was_told(client, db):
    client.cookies["impromptu_tz"] = "Asia%2FKolkata"
    told = post(client).json()
    response = client.get(f"{RUNS}/summary")
    assert response.status_code == 200
    numbers = {"streak": 1, "topics": 1, "minutes": 1}
    assert response.json() == numbers
    assert {key: told[key] for key in numbers} == numbers
    assert response["Cache-Control"] == "private, no-store"
    assert Client().get(f"{RUNS}/summary").json() == {"streak": 0, "topics": 0, "minutes": 0}
