from django.contrib.auth import login as dj_login
from django.contrib.auth import logout as dj_logout
from ninja import Router, Status
from ninja.errors import HttpError

from apps.authentication import services
from apps.authentication.schemas import ForgotIn, LoginIn, MeOut, ResetIn, SignupIn
from apps.authentication.security import session_auth
from apps.common.devices import rotate_device
from apps.common.ratelimit import throttle
from apps.common.referrals import referral_code

api = Router(tags=["auth"])


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
    """One row, signed in, the referral cookie spent. The Slack signup
    event joins here on card 27, after the row commits."""
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


# Password reset. The asking route answers 204 whatever it found, because
# any way of telling "we mailed somebody" from "we did not" turns the
# form into an account oracle. The reset page must not leak the token
# through a Referer header; the frontend sends no-referrer on it.


@api.post("/forgot", response={204: None})
@throttle("forgot-address", "5/hour")
@throttle("forgot-email", "3/hour", key=lambda request, **kwargs: services.normalize_email(kwargs["payload"].email))
def forgot(request, payload: ForgotIn):
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
