"""Signing in claims the device's anonymous runs for the account.

Through Django's login signal, so every door does it and none has to
remember. The collision case is the one that loses data if it is wrong:
a device with anonymous history signing into an account with its own
history has to keep both.
"""

from django.conf import settings
from django.contrib.auth import login
from django.test import Client, RequestFactory

from apps.common.devices import DEVICE_COOKIE, device_id
from apps.runs.models import Run
from apps.runs.services import claim_device, totals
from tests.unit_tests import factories

RUNS = "/api/v1/runs"
PAYLOAD = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60}
PAYLOAD["spoken_seconds"] = 60


def run(client):
    return client.post(RUNS, PAYLOAD, content_type="application/json")


def sign_in(client, user):
    """Through login() itself, the way every door ends, carrying the
    browser's device cookie so the claim knows which device this is."""
    request = RequestFactory().post("/login")
    request.COOKIES = {name: morsel.value for name, morsel in client.cookies.items()}
    request.session = client.session
    login(request, user)
    request.session.save()
    client.cookies[settings.SESSION_COOKIE_NAME] = request.session.session_key
    return request


def test_the_anonymous_history_becomes_the_accounts_and_keeps_counting(client, user, db):
    run(client)
    run(client)
    sign_in(client, user)
    assert Run.objects.filter(user=user).count() == 2
    assert run(client).json()["topics"] == 3


def test_a_device_with_history_signing_into_an_account_with_history_keeps_both(client, user, db):
    factories.RunFactory(user=user, device_id="f" * 32, days_ago=1)
    run(client)
    sign_in(client, user)
    assert Run.objects.filter(user=user).count() == 2
    assert totals("unused", user) == (2, 2)


def test_history_from_another_device_joins_the_same_account(client, user, db):
    run(client)
    sign_in(client, user)
    other = Client()
    run(other)
    sign_in(other, user)
    assert run(other).json()["topics"] == 3


def test_rows_another_account_owns_are_never_claimed(client, user, db):
    """The device id is only a claim on unowned rows; an id that once
    belonged to somebody who signed in cannot carry their history over."""
    other_user = factories.UserFactory()
    factories.RunFactory(user=other_user, device_id="a" * 32)
    assert claim_device("a" * 32, user) == 0
    assert Run.objects.get(user=other_user).device_id == "a" * 32


def test_signing_in_does_not_rotate_the_device(client, user, db):
    """Analytics ride on the device id; a sign-in must not split one person
    into two. Signing out is what rotates."""
    run(client)
    before = client.cookies[DEVICE_COOKIE].value
    request = sign_in(client, user)
    assert device_id(request) in Run.objects.get().device_id
    assert client.cookies[DEVICE_COOKIE].value == before
