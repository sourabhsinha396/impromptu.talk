"""Shared fixtures.

Testing settings blank every provider key. The fixtures here keep each
test starting from nothing, so a run's outcome never depends on order.
"""

import pytest
from django.core.cache import cache
from django.test import Client

from apps.common import ratelimit, slack
from tests.unit_tests import factories


@pytest.fixture(autouse=True)
def _isolate_state():
    cache.clear()
    # Counters persist in process memory, so without this a suite that
    # signs in ten times would trip the limit for the eleventh test.
    ratelimit.reset()
    for factory_class in factories.all_factories():
        factory_class.reset_sequence()
    yield


@pytest.fixture
def user(db):
    return factories.UserFactory(email="speaker@example.com")


# Own Client instances on purpose: reusing pytest-django's `client` here
# would log the shared instance in and silently authenticate the requests
# a test meant to be anonymous.
@pytest.fixture
def auth_client(user):
    logged_in = Client()
    logged_in.force_login(user)
    return logged_in


class Channel:
    """What the suite has instead of a Slack webhook.

    Every test gets one, because the events fire from inside ordinary
    flows - a signup, a settled payment - and a test of those should not
    have to know a channel exists. Testing settings blank the URL on top
    of this; `test_slack.py` asserts both halves, since this is the one
    provider key that costs nothing to reach and a run that found a real
    webhook would pass while posting hundreds of invented signups into the
    channel somebody watches for real ones.
    """

    def __init__(self):
        self.posted: list[str] = []

    def __call__(self, url: str, body: dict) -> int:
        self.posted.append(body["text"])
        return 200

    @property
    def headlines(self) -> list[str]:
        return [text.splitlines()[0].strip("*") for text in self.posted]


@pytest.fixture(autouse=True)
def channel(monkeypatch, settings):
    """The recorder in place of the post, and a URL that is never called
    so the whole of `notify` runs: dropping empty fields, labelling the
    environment and composing the line are what a caller's test reads."""
    recorder = Channel()
    settings.SLACK_WEBHOOK_URL = "https://hooks.slack.invalid/recorded"
    monkeypatch.setattr(slack, "post", recorder)
    return recorder
