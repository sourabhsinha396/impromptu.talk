"""Asking a model for topics, and the ceiling that makes it safe.

Nothing here reaches the provider: every test runs against
`openrouter.RecordingGateway`, and the testing settings blank the key on
top of that. This is the one feature on the site that costs money on every
use, so what is pinned hardest is not the prompt but the allowance.
"""

import datetime as dt

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.topics import generate, openrouter
from apps.topics.models import Generation, Topic
from tests.unit_tests import factories

MINE = "/api/v1/topics/mine"
JSON = "application/json"

ON = override_settings(OPENROUTER_API_KEY="sk-test", OPENROUTER_MODEL="test/model")


@pytest.fixture
def model():
    recorded = openrouter.RecordingGateway()
    openrouter.use_gateway(recorded)
    with ON:
        yield recorded
    openrouter.use_gateway(None)


@pytest.fixture
def pro(user):
    signed_in = Client()
    signed_in.force_login(user)
    signed_in.post(MINE, {"name": "Interview questions", "icon": "mic"}, content_type=JSON)
    return signed_in


def ask(client, prompt="behavioural questions for a first job"):
    return client.post(f"{MINE}/interview-questions/generate", {"prompt": prompt}, content_type=JSON)


class TestTheSuiteCannotSpend:
    def test_the_key_is_blank_and_the_gateway_is_the_recorder(self, model):
        from impromptu.settings import testing

        assert testing.OPENROUTER_API_KEY == ""
        assert openrouter.gateway() is model

    def test_without_a_key_the_route_is_a_404_and_nothing_is_drawn(self, pro):
        """The same 404 as any route that does not exist, rather than a
        button that is drawn and then refuses."""
        assert ask(pro).status_code == 404
        body = pro.get(MINE).json()
        assert body["can_generate"] is False
        assert body["generations_left"] == 0


class TestTheLines:
    def test_what_comes_back_becomes_ordinary_topics(self, pro, model):
        model.text = "Low tide\nCeiling fans, hot take"
        body = ask(pro).json()

        assert body["added"] == 2
        assert [t["text"] for t in body["genre"]["topics"]] == ["Low tide", "Ceiling fans"]
        # Through the same parser a paste uses, so a model cannot coin a
        # style any more than a paste can.
        assert [t["style"] for t in body["genre"]["topics"]] == ["just-talk", "hot-take"]

    def test_list_markers_are_stripped_and_a_year_is_not_one(self):
        """What makes a number a marker is the punctuation after it. An
        earlier version tested for digits alone and ate both of these."""
        assert generate.clean("1. Low tide\n- Ceiling fans\n* Rain") == "Low tide\nCeiling fans\nRain"
        assert generate.clean("1984 was optimistic\n3 Mile Island") == "1984 was optimistic\n3 Mile Island"

    def test_the_model_is_asked_for_twenty_lines_at_the_configured_model(self, pro, model):
        ask(pro)
        sent = model.calls[0]
        assert sent["model"] == "test/model"
        assert f"exactly {generate.WANTED} lines" in sent["system"]
        assert "behavioural questions for a first job" in sent["prompt"]

    def test_a_repeat_of_a_line_already_held_is_not_added_twice(self, pro, model):
        model.text = "Low tide"
        assert ask(pro).json()["added"] == 1
        assert ask(pro).json()["added"] == 0
        assert Topic.objects.count() == 1


class TestTheCeiling:
    def test_the_allowance_is_five_a_month_and_the_sixth_is_refused(self, pro, model, user):
        for n in range(generate.PER_MONTH):
            model.text = f"Line {n}"
            assert ask(pro).json()["generations_left"] == generate.PER_MONTH - n - 1
        response = ask(pro)
        assert response.status_code == 400
        assert str(generate.PER_MONTH) in response.json()["detail"]
        # Refused before the model, not after it.
        assert len(model.calls) == generate.PER_MONTH

    def test_a_failed_call_still_spends_one(self, pro, model, user):
        """It reached the model or it did not, and either way an account
        that can retry a failure for free has no ceiling at all."""
        model.error = openrouter.ModelError("the model is having a day")
        response = ask(pro)
        assert response.status_code == 502
        assert generate.left(user) == generate.PER_MONTH - 1
        row = Generation.objects.get()
        assert row.topics == 0
        assert "having a day" in row.error

    def test_last_months_generations_do_not_count(self, pro, model, user):
        for _ in range(generate.PER_MONTH):
            Generation.objects.create(user=user, prompt="old")
        Generation.objects.update(created_at=timezone.now().replace(day=1) - dt.timedelta(days=1))
        assert generate.left(user) == generate.PER_MONTH
        assert ask(pro).status_code == 200

    def test_the_row_records_what_was_asked_and_what_it_cost(self, pro, model, user):
        ask(pro, "ielts part two")
        row = Generation.objects.get()
        assert (row.prompt, row.model, row.topics) == ("ielts part two", "test/model", 2)
        assert (row.prompt_tokens, row.completion_tokens) == (20, 40)
        assert row.error == ""

    def test_an_empty_prompt_is_refused_before_anything_is_spent(self, pro, model, user):
        assert ask(pro, "   ").status_code == 400
        assert model.calls == []
        assert generate.left(user) == generate.PER_MONTH


class TestWhoMay:
    def test_a_stranger_cannot_generate(self, client, db, model):
        assert client.post(f"{MINE}/whatever/generate", {"prompt": "x"}, content_type=JSON).status_code == 401

    def test_without_pro_it_is_refused_like_every_other_write(self, pro, model):
        with override_settings(
            DODO_API_KEY="live",
            DODO_PRODUCTS={"monthly": "m", "annual": "a", "pass": "p", "lifetime": "l"},
        ):
            assert ask(pro).status_code == 403
        assert Generation.objects.count() == 0

    def test_somebody_elses_genre_is_a_404(self, pro, model, db):
        theirs = factories.GenreFactory(owner=factories.UserFactory(email="x@e.com"), slug="theirs")
        response = pro.post(f"{MINE}/{theirs.slug}/generate", {"prompt": "x"}, content_type=JSON)
        assert response.status_code == 404
        assert Generation.objects.count() == 0
