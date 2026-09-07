"""The visitor's clock, from the timezone cookie the frontend writes.

The round posts its own offset in minutes, exact, from the browser. Pages
that only read (the header pill, the streak page) arrive with nothing
but the `impromptu_tz` cookie, a zone name a script wrote before first
paint, percent-encoded because a cookie value may not carry a bare slash.
Turned into today's offset here with the standard library, so the day a
streak is counted to is the visitor's and not the server's.
"""

import datetime as dt
from urllib.parse import unquote
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

TIMEZONE_COOKIE = "impromptu_tz"


def offset_minutes(zone: str, *, now: dt.datetime | None = None) -> int:
    """Minutes east of UTC for `zone` right now, or 0 for anything that is
    not a zone. Zero is UTC, the same fallback the browser has when it
    cannot say."""
    name = unquote(zone or "")
    if not name:
        return 0
    try:
        offset = (now or dt.datetime.now(dt.UTC)).astimezone(ZoneInfo(name)).utcoffset()
    except (ZoneInfoNotFoundError, ValueError):
        return 0
    return int(offset.total_seconds() // 60) if offset else 0


def request_offset(request) -> int:
    return offset_minutes(request.COOKIES.get(TIMEZONE_COOKIE, ""))
