"""Making an account, checking a password, ending sessions.

Every refusal here is one sentence a person can act on, raised as a 400
so the form re-renders with it and the typing intact. Only a value no
person could have typed is refused at the edge, by the schema, as a 422.
"""

from django.contrib.auth import SESSION_KEY
from django.contrib.auth import authenticate as dj_authenticate
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from ninja.errors import HttpError

from apps.authentication.models import User

MIN_PASSWORD = 8

# Same sentence whichever half was wrong: which one is not the visitor's
# business, and a form that said "no such account" would be a way to ask
# this site whether somebody has one.
WRONG_CREDENTIALS = "That email and password do not match."
TAKEN = "That email already has an account."
NOT_AN_ADDRESS = "That does not look like an email address."
TOO_SHORT = f"Use at least {MIN_PASSWORD} characters."


def normalize_email(email: str) -> str:
    return email.strip().lower()


def tidy_name(name: str) -> str:
    """Whitespace collapsed, so "  Ada   Grace " greets as "Ada Grace"."""
    return " ".join(name.split())


def signup(*, email: str, password: str, name: str = "", referral_code: str = "") -> User:
    address = normalize_email(email)
    try:
        validate_email(address)
    except ValidationError as exc:
        raise HttpError(400, NOT_AN_ADDRESS) from exc
    if len(password) < MIN_PASSWORD:
        raise HttpError(400, TOO_SHORT)
    if User.objects.filter(email=address).exists():
        raise HttpError(400, TAKEN)
    try:
        with transaction.atomic():
            user = User.objects.create_user(address, password, name=tidy_name(name))
    except IntegrityError as exc:
        # Two tabs finishing at once: the row that landed first is the
        # account, and this one is told what the check above would have
        # said a moment earlier.
        raise HttpError(400, TAKEN) from exc
    attribute_referral(user, referral_code)
    return user


def attribute_referral(user: User, code: str) -> None:
    """Write down who brought this account in, if a live code says so.

    Once: an account that already names a referrer keeps it, so the
    affiliate who did the work is not overwritten by whoever's link was
    clicked last. A code nobody holds is ignored rather than refused; the
    signup has already happened. Never the account itself.
    """
    if not code or user.referred_by_id is not None:
        return
    referrer = User.objects.filter(affiliate_code=code).exclude(pk=user.pk).first()
    if referrer is None:
        return
    user.referred_by = referrer
    user.save(update_fields=["referred_by"])


def authenticate(request, *, email: str, password: str) -> User:
    """The account these credentials open, or the one sentence.

    Django's own backend: a row with no password (Google-only) refuses
    every password, an inactive row refuses too, and the hasher runs at
    its full cost even for an address nobody holds, so timing says
    nothing either.
    """
    user = dj_authenticate(request, username=normalize_email(email), password=password)
    if user is None:
        raise HttpError(400, WRONG_CREDENTIALS)
    return user


def end_all_sessions(user: User) -> int:
    """Every signed-in browser this account has, ended, this one included.

    Django keeps no index from an account to its sessions, so the live
    rows are read and the ones naming this account deleted. A scan, but a
    rare one: "sign out everywhere" and a password reset are the callers,
    and the table holds a month of sign-ins at most. Returns how many.
    """
    ended = 0
    for row in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
        if row.get_decoded().get(SESSION_KEY) == str(user.pk):
            row.delete()
            ended += 1
    return ended
