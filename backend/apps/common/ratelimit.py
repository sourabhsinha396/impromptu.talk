"""Sliding-window rate limiting over the `limits` library.

The library only counts. Who a request is (the keying) and what a
refusal looks like (the 429 in urls.py) stay here; each route declares
its own rate beside itself, and none of it lives in env.
"""

import logging
import math
import time
from functools import wraps

from django.conf import settings
from limits import parse
from limits.errors import StorageError
from limits.storage import storage_from_string
from limits.strategies import SlidingWindowCounterRateLimiter

logger = logging.getLogger(__name__)

_limiter = None


def _get_limiter():
    global _limiter
    if _limiter is None:
        # wrap_exceptions=True so a backend's own connection errors surface
        # as StorageError; without it a redis outage raises redis exceptions
        # and the fail-open catch below misses them.
        storage = storage_from_string(settings.RATELIMIT_STORAGE_URI, wrap_exceptions=True)
        _limiter = SlidingWindowCounterRateLimiter(storage)
    return _limiter


def reset():
    """Drop every counter and the limiter itself. Tests only: a suite that
    signs in ten times must not trip the limit for the eleventh."""
    global _limiter
    if _limiter is not None:
        _limiter.storage.reset()
    _limiter = None


class RateLimited(Exception):
    def __init__(self, name, item, key):
        self.name = name
        self.item = item
        self.key = key


def client_ip(request):
    """The address a limit keys on.

    Every legitimate request rides the frontend rewrite, so REMOTE_ADDR
    is the frontend host, never the person. The connecting peer is the
    first trusted hop and each proxy appends the peer it saw, so the
    client sits just left of the trusted hops in the combined chain.
    Entries further left are client-supplied: an attacker padding
    X-Forwarded-For must not get to pick their own bucket.
    """
    remote = request.META.get("REMOTE_ADDR", "unknown")
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    chain.append(remote)
    hops = settings.RATELIMIT_TRUSTED_PROXY_HOPS
    if len(chain) > hops:
        return chain[-(hops + 1)]
    return remote


def throttle(name, rate, key=None):
    """Attach a sliding-window limit to a ninja operation.

    `key` names whose budget a request spends: the client address when
    left out, or a callable handed the view's own arguments, for a limit
    per account or per device. Two decorators stack on a route that
    keeps both, as sign-in does (per address and per email). Applied
    under the router decorator, so the registered view is the guarded
    one. The marker it leaves is load-bearing: a test can walk a router
    and refuse any open route without one, because the failure mode is
    a decorator quietly dropped.
    """
    item = parse(rate)

    def decorator(view):
        @wraps(view)
        def guarded(request, *args, **kwargs):
            bucket = client_ip(request) if key is None else key(request, *args, **kwargs)
            try:
                allowed = _get_limiter().hit(item, name, bucket)
            except StorageError:
                # Fail-open on purpose: a throttle that takes sign-in down
                # with its storage is worse than no throttle.
                logger.warning("rate limit storage failed; letting %s through", name)
                allowed = True
            if not allowed:
                raise RateLimited(name=name, item=item, key=bucket)
            return view(request, *args, **kwargs)

        guarded.throttles = [*getattr(view, "throttles", []), {"name": name, "rate": rate}]
        return guarded

    return decorator


def retry_after(exc):
    """Seconds until the refused window opens again, never below one."""
    try:
        stats = _get_limiter().get_window_stats(exc.item, exc.name, exc.key)
    except StorageError:
        return 1
    return max(1, math.ceil(stats.reset_time - time.time()))
