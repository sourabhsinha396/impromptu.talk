"""Google sign-in: the second door, ending in the same session as the form.

Fails closed, unlike the captcha: an unreachable Google handled leniently
would sign somebody in as an account they have not proved they own. Both
routes in `apis.py` 404 when either key is unset, the same answer as a
route that does not exist, because a button hidden leniently is still a
button somebody can type the URL of.

`next` travels in a signed `state` alongside a nonce, because the redirect
URI registered with Google is one fixed string and cannot carry it itself.
The nonce is cross-checked against a short-lived cookie, so the callback
must be this browser's own visit to Google, not a code copied out of
somebody else's browser.

Unlike v0, which decoded the ID token's payload by hand and deliberately
skipped its signature (trusting the TLS connection this process itself
opened to Google for the code exchange instead), this asks Google's own
userinfo endpoint for the identity, one more HTTPS call with the standard
library, matching the pattern `apps/common/mail.py` already uses for Brevo.
No JWT parsing to get wrong, and no unverified claim ever reaches a caller.
"""

import json
import secrets
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core import signing

STATE_SALT = "auth.google.state"
STATE_MAX_AGE = 600
AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
TIMEOUT = 10


class GoogleAuthFailed(Exception):
    """The code, or the token it bought, did not check out."""


def enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def callback_url() -> str:
    return f"{settings.FRONTEND_ORIGIN}/api/v1/auth/google/callback"


def authorize_redirect(next_path: str) -> tuple[str, str]:
    """The URL to send the browser to, and the nonce to remember in a
    cookie until the callback comes back."""
    nonce = secrets.token_urlsafe(24)
    state = signing.dumps({"n": nonce, "next": next_path}, salt=STATE_SALT)
    query = urllib.parse.urlencode(
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": callback_url(),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    return f"{AUTHORIZE_URL}?{query}", nonce


def unpack_state(state: str, nonce: str) -> str | None:
    """The `next` path the state was minted with, or None when the state
    is missing, expired, tampered with, or does not match the nonce the
    cookie carried."""
    if not state or not nonce:
        return None
    try:
        payload = signing.loads(state, salt=STATE_SALT, max_age=STATE_MAX_AGE)
    except signing.BadSignature:
        return None
    if payload.get("n") != nonce:
        return None
    return payload.get("next") or "/"


def account(code: str) -> dict:
    """The verified identity a code stands for: `sub`, `email`, `name`.
    Raises `GoogleAuthFailed` for anything Google itself refused or an
    unverified address, which this treats the same as a refusal."""
    tokens = _exchange(code)
    info = _userinfo(tokens.get("access_token", ""))
    if not info.get("sub") or not info.get("email"):
        raise GoogleAuthFailed("Google did not answer with an account.")
    if not info.get("email_verified"):
        raise GoogleAuthFailed("That Google account has not verified its email.")
    return {"sub": info["sub"], "email": info["email"], "name": info.get("name", "")}


def _exchange(code: str) -> dict:
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url(),
            "grant_type": "authorization_code",
        }
    ).encode()
    return _post(TOKEN_URL, body)


def _userinfo(access_token: str) -> dict:
    request = urllib.request.Request(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
            return json.loads(response.read())
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise GoogleAuthFailed("Google did not answer.") from exc


def _post(url: str, body: bytes) -> dict:
    request = urllib.request.Request(url, data=body, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310
            return json.loads(response.read())
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise GoogleAuthFailed("Google did not accept that code.") from exc
