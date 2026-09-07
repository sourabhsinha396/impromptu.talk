"""Making an account, checking a password, ending sessions.

Every refusal here is one sentence a person can act on, raised as a 400
so the form re-renders with it and the typing intact. Only a value no
person could have typed is refused at the edge, by the schema, as a 422.
"""

from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.contrib.auth import authenticate as dj_authenticate
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from ninja.errors import HttpError

from apps.authentication.models import User
from apps.common import mail

MIN_PASSWORD = 8

# Same sentence whichever half was wrong: which one is not the visitor's
# business, and a form that said "no such account" would be a way to ask
# this site whether somebody has one.
WRONG_CREDENTIALS = "That email and password do not match."
TAKEN = "That email already has an account."
NOT_AN_ADDRESS = "That does not look like an email address."
TOO_SHORT = f"Use at least {MIN_PASSWORD} characters."
LINK_DEAD = "That link has expired or has already been used."
NOT_HUMAN = "Confirm you're not a robot."
WRONG_PASSWORD = "That is not your current password."
PRO_ONLY = "Pro is needed to keep a colour."


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


def google_login(*, sub: str, email: str, name: str, referral_code: str = "") -> User:
    """The account a Google identity opens: matched by `sub` first, because
    it survives a change of address where the address does not survive a
    change of owner; else an existing row's normalized email, which links
    it rather than making a second row, since a verified Google address is
    proof enough to add a second way in; else a brand new row with no
    password at all. Only a genuinely new row gets the referral cookie, as
    `signup` does; a linked row already has whatever it had.
    """
    address = normalize_email(email)
    user = User.objects.filter(google_sub=sub).first()
    if user is not None:
        return user
    user = User.objects.filter(email=address).first()
    if user is not None:
        if user.google_sub != sub:
            user.google_sub = sub
            user.save(update_fields=["google_sub"])
        return user
    try:
        with transaction.atomic():
            user = User.objects.create_user(address, None, name=tidy_name(name), google_sub=sub)
    except IntegrityError:
        # Two tabs finishing the same sign-in at once: the row that landed
        # first is the account, matched by whichever key it landed under.
        user = User.objects.filter(google_sub=sub).first() or User.objects.filter(email=address).first()
        if user is None:
            raise
        return user
    attribute_referral(user, referral_code)
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


# Password reset. Django's token is signed over the account's password
# hash and last sign-in with an hour's timestamp, so there is no table and
# nothing to spend: a reset changes the password and signs in, and every
# link sent before it dies at that moment. Until then, every link sent in
# the hour works, which is the one change from v0 (DECISIONS.md).


def request_reset(email: str) -> bool:
    """Mail a link, if there is anywhere to mail it. The endpoint answers
    the same either way: a form that said "no account with that email"
    would be a way to ask this site whether somebody has one. True when a
    mail went out, for the tests."""
    user = User.objects.filter(email=normalize_email(email), is_active=True).first()
    if user is None:
        return False
    token = f"{urlsafe_base64_encode(force_bytes(user.pk))}.{default_token_generator.make_token(user)}"
    return mail.send(
        "password_reset",
        to=user.email,
        subject=f"Reset your {settings.SITE_NAME} password",
        link=f"{settings.FRONTEND_ORIGIN}/reset/{token}",
    )


def reset_user(token: str) -> User | None:
    """The account a link names, if the link is still live."""
    uid, _, signed = token.partition(".")
    try:
        user = User.objects.get(pk=urlsafe_base64_decode(uid).decode(), is_active=True)
    except (ValueError, TypeError, OverflowError, User.DoesNotExist):
        return None
    return user if default_token_generator.check_token(user, signed) else None


def reset_password(token: str, password: str) -> User:
    """Set the password the link's owner chose and end every other
    session: whoever knew the old password no longer holds the account. A
    Google-only row gains a password here, which is how it gets one."""
    user = reset_user(token)
    if user is None:
        raise HttpError(400, LINK_DEAD)
    if len(password) < MIN_PASSWORD:
        raise HttpError(400, TOO_SHORT)
    user.set_password(password)
    user.save(update_fields=["password"])
    end_all_sessions(user)
    return user


# What the account can change about itself. The colour, the name and the
# password are the three things settings owns; everything else on these
# pages belongs to another card's domain and is read, not written, here.

# The six in the palette, and the same six as lib/palette.ts and the
# [data-accent] rules in globals.css. Duplicated across the two languages
# because it is product policy on both sides of the wire, not config.
ACCENTS = ("lime", "amber", "coral", "magenta", "violet", "cyan")


def valid_accent(slug: str) -> str:
    """One of the six, or blank for the default. Unknown is the default
    rather than a refusal, as v0 did with its icon and format validators:
    this value is rendered into an attribute on <html>, so the one thing
    it must never be is whatever somebody typed."""
    return slug if slug in ACCENTS else ""


def set_name(user: User, name: str) -> User:
    """What we call somebody. Blank is allowed and means no name: the
    field is optional at signup, and clearing it has to be possible or
    a name typed once could never be taken back."""
    user.name = tidy_name(name)
    user.save(update_fields=["name"])
    return user


def set_accent(user: User, slug: str) -> User:
    user.accent = valid_accent(slug)
    user.save(update_fields=["accent"])
    return user


def change_password(user: User, *, current: str, password: str) -> User:
    """Set a new password, and end every other browser's session.

    A row with a password confirms the old one first: this session is
    already open, so without that check a borrowed laptop is a taken
    account. A Google-only row has none to confirm and is not asked for
    one it could never supply; setting one here is how it gains a second
    way in, and Google keeps working.

    The caller signs this browser back in, because `end_all_sessions`
    cannot know which of the rows it deletes is the one asking.
    """
    if user.has_usable_password() and not user.check_password(current):
        raise HttpError(400, WRONG_PASSWORD)
    if len(password) < MIN_PASSWORD:
        raise HttpError(400, TOO_SHORT)
    user.set_password(password)
    user.save(update_fields=["password"])
    end_all_sessions(user)
    return user
