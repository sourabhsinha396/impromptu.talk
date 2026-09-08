from django.conf import settings
from django.contrib.auth import login as dj_login
from django.contrib.auth import logout as dj_logout
from django.http import Http404, HttpResponseRedirect
from ninja import Router, Status
from ninja.errors import HttpError

from apps.affiliates import services as affiliates
from apps.authentication import google as google_auth
from apps.authentication import services
from apps.authentication.schemas import (
    AccentIn,
    AccountOut,
    ForgotIn,
    LoginIn,
    MeOut,
    NameIn,
    PasswordIn,
    ResetIn,
    SignupIn,
)
from apps.authentication.security import session_auth
from apps.common import recaptcha
from apps.common.devices import rotate_device
from apps.common.ratelimit import throttle
from apps.common.referrals import referral_code
from apps.payments import services as payments

api = Router(tags=["auth"])

OAUTH_COOKIE = "yapholic_oauth"
OAUTH_COOKIE_AGE = 600


@api.get("/me", auth=session_auth, response=MeOut)
def me(request):
    """The account behind the session. Every page asks, to draw the menu
    and the footer in their signed-in shape; a stranger is told 401 and
    gets the signed-out shape, which is the answer and not an error."""
    return request.auth


# Both doors end in Django's login(), which fires the signal that claims
# this device's anonymous runs for the account (apps/runs/services.py),
# so neither has to remember. The device cookie is not rotated on the way
# in: analytics ride on it, and a sign-in must not split one person in two.


@api.post("/signup", response={201: MeOut})
@throttle("signup", "5/hour")
def signup(request, payload: SignupIn):
    """One row, signed in, the referral cookie spent."""
    if not recaptcha.human(payload.recaptcha_token):
        raise HttpError(400, services.NOT_HUMAN)
    user = services.signup(
        email=payload.email, password=payload.password, name=payload.name, referral_code=referral_code(request)
    )
    dj_login(request, user)
    return Status(201, user)


@api.post("/login", response=MeOut)
# Per address and per account, stacked: a throttled account refuses the
# right password too, or the limit is decorative. The account's window
# is keyed on the address typed, so it holds before the row is looked up.
@throttle("login-address", "10/15minute")
@throttle("login-email", "5/15minute", key=lambda request, **kwargs: services.normalize_email(kwargs["payload"].email))
def login(request, payload: LoginIn):
    if not recaptcha.human(payload.recaptcha_token):
        raise HttpError(400, services.NOT_HUMAN)
    user = services.authenticate(request, email=payload.email, password=payload.password)
    dj_login(request, user)
    return user


@api.post("/logout", response={204: None})
def logout(request):
    """End this browser's session and hand it a fresh device, so a shared
    computer is left clean. Open to strangers: a stale menu whose session
    already expired is told it worked, and its device is left alone, since
    rotating it would throw away the anonymous streak it still holds."""
    if request.user.is_authenticated:
        dj_logout(request)
        rotate_device(request)
    return Status(204, None)


@api.post("/logout/everywhere", auth=session_auth, response={204: None})
def logout_everywhere(request):
    """Every session this account has, this one included. The button is on
    the account's additional settings (card 23)."""
    services.end_all_sessions(request.auth)
    dj_logout(request)
    rotate_device(request)
    return Status(204, None)


# Google: the second door. Both routes 404 when either key is unset,
# rather than answering something a caller could mistake for "try later" -
# a route that does not exist is the same lie every other unbuilt path on
# the site already tells. `next` is validated here, before it is signed
# into the state; the callback trusts what its own signature says.


@api.get("/google")
def google_start(request, next: str = "/"):
    if not google_auth.enabled():
        raise Http404
    safe_next = next if next.startswith("/") and not next.startswith("//") else "/"
    url, nonce = google_auth.authorize_redirect(safe_next)
    response = HttpResponseRedirect(url)
    response.set_signed_cookie(
        OAUTH_COOKIE,
        nonce,
        max_age=OAUTH_COOKIE_AGE,
        httponly=True,
        samesite="Lax",
        secure=settings.SESSION_COOKIE_SECURE,
    )
    return response


@api.get("/google/callback")
def google_callback(request, code: str = "", state: str = "", error: str = ""):
    if not google_auth.enabled():
        raise Http404
    nonce = request.get_signed_cookie(OAUTH_COOKIE, default="", max_age=OAUTH_COOKIE_AGE)
    next_path = None if error else google_auth.unpack_state(state, nonce)
    if next_path is not None:
        try:
            identity = google_auth.account(code)
        except google_auth.GoogleAuthFailed:
            next_path = None
        else:
            user = services.google_login(
                sub=identity["sub"],
                email=identity["email"],
                name=identity["name"],
                referral_code=referral_code(request),
            )
            dj_login(request, user)
    response = HttpResponseRedirect(next_path if next_path is not None else "/login?google_error=1")
    response.delete_cookie(OAUTH_COOKIE)
    return response


# Password reset. The asking route answers 204 whatever it found, because
# any way of telling "we mailed somebody" from "we did not" turns the
# form into an account oracle. The reset page must not leak the token
# through a Referer header; the frontend sends no-referrer on it.


@api.post("/forgot", response={204: None})
@throttle("forgot-address", "5/hour")
@throttle("forgot-email", "3/hour", key=lambda request, **kwargs: services.normalize_email(kwargs["payload"].email))
def forgot(request, payload: ForgotIn):
    if not recaptcha.human(payload.recaptcha_token):
        raise HttpError(400, services.NOT_HUMAN)
    services.request_reset(payload.email)
    return Status(204, None)


@api.get("/reset/{token}", response={204: None})
def reset_link(request, token: str):
    """Whether a link is still live, so the page can show the form or the
    sentence before anybody types a password into a dead one."""
    if services.reset_user(token) is None:
        raise HttpError(400, services.LINK_DEAD)
    return Status(204, None)


@api.post("/reset", response=MeOut)
@throttle("reset", "10/hour")
def reset(request, payload: ResetIn):
    """Set the password and sign in on the spot: they have just proved
    they hold the address and chosen a password, and a login form after
    that protects nobody. Every other session ended in the service."""
    user = services.reset_password(payload.token, payload.password)
    dj_login(request, user)
    return user


# Settings. Four routes behind the session, one per thing the account can
# change about itself, each answering the shape the page already holds so
# nothing has to be re-fetched to redraw one card.


@api.get("/account", auth=session_auth, response=AccountOut)
def account(request):
    """Everything the two settings pages draw. One call rather than the
    page assembling itself out of /me and the streak's history, which
    would fetch a year of runs to learn whether a switch is on."""
    user = request.auth
    row = payments.held(user)
    plan = payments.plan_of(row)
    return {
        "email": user.email,
        "name": user.name,
        "accent": user.accent,
        "has_password": user.has_usable_password(),
        "share_token": user.share_token,
        # Minted on the first look at the page that shows it, as the
        # affiliate page does: a link is shown rather than asked for.
        "affiliate_code": affiliates.code_for(user),
        "is_pro": payments.is_pro(user),
        "plan": plan
        and {
            "code": plan.code,
            "name": plan.name,
            "recurring": plan.recurring,
            "note": plan.note,
            "expires_at": row.expires_at.isoformat() if row and row.expires_at else None,
            "cancels": bool(row and row.cancel_at_next_billing_date),
        },
    }


@api.patch("/name", auth=session_auth, response=MeOut)
def set_name(request, payload: NameIn):
    return services.set_name(request.auth, payload.name)


@api.patch("/accent", auth=session_auth, response=MeOut)
def set_accent(request, payload: AccentIn):
    """The colour is Pro's. Everybody may look at all six; keeping one is
    what is bought, and with nothing for sale everybody may keep one. The
    refusal is here and not only in the page, or the gate is decoration."""
    if not payments.is_pro(request.auth):
        raise HttpError(400, services.PRO_ONLY)
    return services.set_accent(request.auth, payload.accent)


@api.post("/password", auth=session_auth, response=MeOut)
# Per account, and low: this route checks a secret, so it is a guessing
# surface even behind a session, and nobody changes their password twice
# in a morning.
@throttle("password", "10/hour", key=lambda request, **kwargs: str(request.auth.pk))
def set_password(request, payload: PasswordIn):
    """Change the password, or set the first one on a Google-only row.
    Every other browser is signed out; this one is signed back in on the
    spot, so the person who just proved they hold the account is not the
    one it locks out."""
    user = services.change_password(request.auth, current=payload.current, password=payload.password)
    dj_login(request, user)
    return user
