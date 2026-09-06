"""The anonymous visitor cookie, which carries a streak before there is an account.

Signed with Django's own signing, so a forged or edited value counts as
absent and is answered with a fresh id, rather than letting a visitor
pick up another device's history by typing its id in.
"""

import uuid

from django.conf import settings

DEVICE_COOKIE = "impromptu_device"
DEVICE_MAX_AGE = 60 * 60 * 24 * 730


def device_id(request) -> str:
    # Memoised, or the id a view records against and the id the middleware
    # writes to the cookie would be two different uuids.
    existing = getattr(request, "_device_id", None)
    if existing is None:
        existing = _from_cookie(request) or uuid.uuid4().hex
        request._device_id = existing
    return existing


def rotate_device(request) -> str:
    """A claimed device starts fresh, so signing out leaves no history
    behind. The middleware writes the new id on the way out."""
    fresh = uuid.uuid4().hex
    request._device_id = fresh
    return fresh


def _from_cookie(request) -> str:
    # A missing, forged or expired cookie all read as "" here; the caller
    # mints a fresh id for each.
    return request.get_signed_cookie(DEVICE_COOKIE, default="", max_age=DEVICE_MAX_AGE)


class DeviceCookieMiddleware:
    """Every API response carries the device cookie: issued on first
    contact, replaced when the one that arrived was forged, rewritten
    after a rotation. One rule in the one place every API response
    passes through, so no view can forget to write it. The admin is
    left alone; nothing there has a streak.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            did = device_id(request)
            if did != _from_cookie(request):
                # The same flags as the session cookie, for the same reasons.
                response.set_signed_cookie(
                    DEVICE_COOKIE,
                    did,
                    max_age=DEVICE_MAX_AGE,
                    httponly=True,
                    samesite="Lax",
                    secure=settings.SESSION_COOKIE_SECURE,
                )
        return response
