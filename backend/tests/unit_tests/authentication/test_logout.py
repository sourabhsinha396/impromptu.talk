"""Signing out: this browser, or every browser. The device is rotated so a
shared computer is left clean, and never for a stranger, whose anonymous
streak rides on it."""

from django.contrib.sessions.models import Session
from django.test import Client

from apps.common.devices import DEVICE_COOKIE
from tests.unit_tests import factories

LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
EVERYWHERE = "/api/v1/auth/logout/everywhere"
ME = "/api/v1/auth/me"
RUNS = "/api/v1/runs"
RUN = {"topic_text": "Low tide", "genre_slug": "general", "prep_seconds": 60, "speak_seconds": 60, "spoken_seconds": 60}


def sign_in(client):
    body = {"email": "speaker@example.com", "password": factories.PASSWORD}
    return client.post(LOGIN, body, content_type="application/json")


def test_signing_out_ends_the_session_and_rotates_the_device(client, user):
    client.post(RUNS, RUN, content_type="application/json")
    sign_in(client)
    before = client.cookies[DEVICE_COOKIE].value
    assert client.post(LOGOUT).status_code == 204
    assert client.get(ME).status_code == 401
    assert client.cookies[DEVICE_COOKIE].value != before
    # A clean slate: the run made before signing in belongs to the account
    # now, and this browser starts again from one.
    assert client.post(RUNS, RUN, content_type="application/json").json()["topics"] == 1


def test_signing_out_on_one_device_leaves_the_other_alone(client, user):
    other = Client()
    sign_in(client)
    sign_in(other)
    client.post(LOGOUT)
    assert other.get(ME).status_code == 200


def test_a_stranger_signing_out_is_told_it_worked_and_keeps_their_device(client, db):
    client.post(RUNS, RUN, content_type="application/json")
    device = client.cookies[DEVICE_COOKIE].value
    assert client.post(LOGOUT).status_code == 204
    assert client.cookies[DEVICE_COOKIE].value == device


def test_signing_out_everywhere_ends_every_session_including_this_one(client, user):
    other = Client()
    bystander = Client()
    bystander.force_login(factories.UserFactory(email="other@example.com"))
    sign_in(client)
    sign_in(other)
    assert client.post(EVERYWHERE).status_code == 204
    assert client.get(ME).status_code == 401
    assert other.get(ME).status_code == 401
    assert bystander.get(ME).status_code == 200
    assert Session.objects.count() == 1


def test_signing_out_everywhere_needs_a_session(client, db):
    assert client.post(EVERYWHERE).status_code == 401
