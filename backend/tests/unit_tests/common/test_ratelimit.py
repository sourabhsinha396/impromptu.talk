"""The throttle. Counters come from `limits`; what is tested here is our
keying, the fail-open and the client address rule, which are the parts
that are ours to get wrong."""

import pytest
from django.test import RequestFactory
from limits import parse
from limits.errors import StorageError

from apps.common import ratelimit

rf = RequestFactory()


def test_a_direct_request_keys_on_its_own_address():
    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    assert ratelimit.client_ip(request) == "203.0.113.9"


def test_a_request_through_the_rewrite_keys_on_the_forwarded_client():
    request = rf.get("/", REMOTE_ADDR="10.0.0.5", HTTP_X_FORWARDED_FOR="198.51.100.7")
    assert ratelimit.client_ip(request) == "198.51.100.7"


def test_a_client_padding_the_forwarded_header_cannot_pick_its_bucket():
    request = rf.get("/", REMOTE_ADDR="10.0.0.5", HTTP_X_FORWARDED_FOR="6.6.6.6, 198.51.100.7")
    assert ratelimit.client_ip(request) == "198.51.100.7"


def test_a_chain_shorter_than_the_trusted_depth_falls_back_to_the_peer(settings):
    settings.RATELIMIT_TRUSTED_PROXY_HOPS = 2
    request = rf.get("/", REMOTE_ADDR="10.0.0.5", HTTP_X_FORWARDED_FOR="198.51.100.7")
    assert ratelimit.client_ip(request) == "10.0.0.5"


def test_a_deeper_trusted_chain_reads_past_both_proxies(settings):
    settings.RATELIMIT_TRUSTED_PROXY_HOPS = 2
    request = rf.get("/", REMOTE_ADDR="10.0.0.5", HTTP_X_FORWARDED_FOR="198.51.100.7, 10.0.0.6")
    assert ratelimit.client_ip(request) == "198.51.100.7"


def guarded_view(key=None):
    @ratelimit.throttle("test-window", "3/minute", key=key)
    def view(request, email=""):
        return "ok"

    return view


def test_the_window_admits_up_to_the_limit_then_refuses():
    view = guarded_view()
    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(3):
        assert view(request) == "ok"
    with pytest.raises(ratelimit.RateLimited):
        view(request)


def test_clients_do_not_share_a_window():
    view = guarded_view()
    for _ in range(3):
        view(rf.get("/", REMOTE_ADDR="203.0.113.9"))
    other = rf.get("/", REMOTE_ADDR="203.0.113.10")
    assert view(other) == "ok"


def test_two_routes_on_the_same_rate_keep_separate_budgets():
    @ratelimit.throttle("first", "3/minute")
    def first(request):
        return "ok"

    @ratelimit.throttle("second", "3/minute")
    def second(request):
        return "ok"

    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(3):
        first(request)
    assert second(request) == "ok"


def test_a_key_of_the_views_own_arguments_limits_per_identity():
    """Sign-in keeps a budget per account as well as per address, so one
    address guessing at one account runs out long before the address does."""
    view = guarded_view(key=lambda request, email="": email)
    address = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(3):
        assert view(address, email="one@example.com") == "ok"
    with pytest.raises(ratelimit.RateLimited):
        view(rf.get("/", REMOTE_ADDR="203.0.113.10"), email="one@example.com")
    assert view(address, email="two@example.com") == "ok"


def test_stacked_throttles_both_count_and_both_leave_a_marker():
    @ratelimit.throttle("by-address", "5/minute")
    @ratelimit.throttle("by-email", "2/minute", key=lambda request, email="": email)
    def view(request, email=""):
        return "ok"

    assert [mark["name"] for mark in view.throttles] == ["by-email", "by-address"]
    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(2):
        view(request, email="one@example.com")
    with pytest.raises(ratelimit.RateLimited) as caught:
        view(request, email="one@example.com")
    assert caught.value.name == "by-email"


def test_the_marker_names_the_declared_rate():
    view = guarded_view()
    assert view.throttles == [{"name": "test-window", "rate": "3/minute"}]


def test_a_storage_failure_lets_the_request_through(monkeypatch):
    view = guarded_view()

    class BrokenLimiter:
        def hit(self, *args, **kwargs):
            raise StorageError(Exception("store is down"))

    monkeypatch.setattr(ratelimit, "_get_limiter", lambda: BrokenLimiter())
    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(20):
        assert view(request) == "ok"


def test_retry_after_waits_at_least_a_second_and_at_most_the_window():
    view = guarded_view()
    request = rf.get("/", REMOTE_ADDR="203.0.113.9")
    for _ in range(3):
        view(request)
    with pytest.raises(ratelimit.RateLimited) as caught:
        view(request)
    assert 1 <= ratelimit.retry_after(caught.value) <= 60


def test_the_rates_the_route_cards_carry_over_parse():
    for rate in ("10/15minute", "5/15minute", "5/hour", "3/hour", "120/hour"):
        assert parse(rate).amount > 0
