"""The referral cookie: whose link brought this browser here.

The frontend writes it from `?ref=` on any page (`proxy.ts`), for sixty
days, last click wins. This side only reads it, at the two moments a
click is spent: signing up (card 19) and opening a checkout (card 26).
Nothing here checks that the code exists; that is decided at those two
moments by whoever holds the users table, because a dead code in
somebody's old post is not the new account's problem.
"""

import re

REFERRAL_COOKIE = "yapholic_ref"

# What a code may look like: lowercase letters and digits, nothing else.
# The frontend refuses anything else before it becomes a cookie, and this
# side refuses it again before it becomes a query, because a value that
# crossed a cookie header is not one this process wrote.
CODE = re.compile(r"[a-z0-9]{2,24}")


def valid_code(value: str | None) -> str:
    """The code, or "" for anything that is not one."""
    code = (value or "").strip().lower()
    return code if CODE.fullmatch(code) else ""


def referral_code(request) -> str:
    """The code this browser is carrying, or ""."""
    return valid_code(request.COOKIES.get(REFERRAL_COOKIE))
