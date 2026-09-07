"""The streak page's answer: a calendar exactly as long as the plan
tracks, the list capped where the plan caps it, and the same numbers the
headline shows, from one read."""

import datetime as dt

from django.test import Client

from apps.runs.history import history
from apps.runs.streaks import FREE, local_dates, pro_rule
from tests.unit_tests.factories import DEVICE, RunFactory, runs_on_days

HISTORY = "/api/v1/runs/history"


def test_the_calendar_is_the_plans_window_ending_today_with_counts_per_local_day(db):
    runs_on_days([0, 0, 1, 3])
    shown = history(DEVICE)
    today = local_dates(DEVICE)[0]
    assert shown.days == 5
    assert [d.date for d in shown.calendar] == [today - dt.timedelta(days=n) for n in range(4, -1, -1)]
    assert [d.count for d in shown.calendar] == [0, 1, 0, 1, 2]
    assert not any(d.frozen for d in shown.calendar)


def test_a_pro_calendar_is_as_long_as_the_plan_and_marks_the_days_the_freeze_held(db):
    runs_on_days([0, 3, 4])
    shown = history(DEVICE, rule=pro_rule(30))
    assert len(shown.calendar) == 30
    assert [d.frozen for d in shown.calendar[-5:]] == [False, False, True, True, False]
    assert shown.summary.streak == 3


def test_recent_is_newest_first_and_capped_where_the_plan_caps_it(db):
    for n in range(30):
        RunFactory(days_ago=0, hours_ago=n, topic_text=f"Topic {n}")
    free = history(DEVICE)
    assert len(free.recent) == 25
    assert free.recent[0].topic_text == "Topic 0"
    assert free.summary.topics == 30
    assert free.runs_kept == 25
    assert len(history(DEVICE, rule=pro_rule(365)).recent) == 30


def test_the_endpoint_answers_the_page_in_one_private_call(client, db):
    run = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60}
    run["spoken_seconds"] = 60
    client.post("/api/v1/runs", run, content_type="application/json")
    response = client.get(HISTORY)
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    body = response.json()
    assert {k: body[k] for k in ("streak", "longest", "topics", "minutes", "would_be", "days", "runs_kept")} == {
        "streak": 1,
        "longest": 1,
        "topics": 1,
        "minutes": 1,
        "would_be": 1,
        "days": FREE.days,
        "runs_kept": FREE.runs,
    }
    assert len(body["calendar"]) == 5 and body["calendar"][-1]["count"] == 1
    assert body["recent"][0]["topic_text"] == "Low tide"
    assert body["recent"][0]["genre_slug"] == "general"
    assert body["recent"][0]["at"].endswith("+00:00")


def test_another_device_sees_nothing_of_it(db):
    RunFactory(days_ago=0)
    body = Client().get(HISTORY).json()
    assert body["topics"] == 0 and body["recent"] == [] and body["streak"] == 0
