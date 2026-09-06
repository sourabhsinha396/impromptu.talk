"""Shared fixtures.

Testing settings blank every provider key. The fixtures here keep each
test starting from nothing, so a run's outcome never depends on order.
"""

import pytest
from django.core.cache import cache
from django.test import Client

from apps.common import ratelimit


@pytest.fixture(autouse=True)
def _isolate_state():
    cache.clear()
    # Counters persist in process memory, so without this a suite that
    # signs in ten times would trip the limit for the eleventh test.
    ratelimit.reset()
    yield


@pytest.fixture
def user(db):
    from apps.authentication.models import User

    return User.objects.create_user("speaker@example.com", "correct horse battery")


# Own Client instances on purpose: reusing pytest-django's `client` here
# would log the shared instance in and silently authenticate the requests
# a test meant to be anonymous.
@pytest.fixture
def auth_client(user):
    logged_in = Client()
    logged_in.force_login(user)
    return logged_in
