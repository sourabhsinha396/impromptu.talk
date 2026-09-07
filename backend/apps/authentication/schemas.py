from ninja import Schema
from pydantic import Field


class MeOut(Schema):
    """Who is signed in, as the chrome needs it: what to call them,
    whether the operator door shows, and the accent every page paints
    with. Nothing else about the account leaves the server on this route;
    the settings pages ask `/account` for the rest."""

    email: str
    name: str
    is_superuser: bool
    accent: str


# The ceilings below refuse only what no person could have typed: a
# three-kilobyte address is not a person. Everything a person can get
# wrong (a short password, a taken address, a malformed one) is checked
# in services.py and answered with a sentence, never a bare 422. The
# extra fields pydantic drops by default are the point too: a post
# carrying is_superuser is a post carrying nothing.


class SignupIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)
    name: str = Field(default="", max_length=80)
    recaptcha_token: str = Field(default="", max_length=2000)


class LoginIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)
    recaptcha_token: str = Field(default="", max_length=2000)


class ForgotIn(Schema):
    email: str = Field(max_length=254)
    recaptcha_token: str = Field(default="", max_length=2000)


class ResetIn(Schema):
    # Longer than a token can be and shorter than anything a script would
    # try; the shape is checked by Django's own generator.
    token: str = Field(max_length=200)
    password: str = Field(max_length=128)


class AccountOut(Schema):
    """Everything the settings pages draw, in one answer. Wider than
    `MeOut` because these two pages are the only place the account looks
    at itself: whether a password exists decides whether the form asks
    for the current one, and the share token decides whether the switch
    is on. `has_password` and not the hash, ever."""

    email: str
    name: str
    accent: str
    has_password: bool
    share_token: str | None


class NameIn(Schema):
    name: str = Field(default="", max_length=80)


class AccentIn(Schema):
    # An unknown slug is the default rather than a refusal, as the
    # frontend's validAccent does: the value ends up in an attribute on
    # <html>, and the one thing it must never be is whatever was typed.
    accent: str = Field(default="", max_length=20)


class PasswordIn(Schema):
    # Blank for a Google-only row, which has no current password to
    # confirm and is never asked for one it could not supply.
    current: str = Field(default="", max_length=128)
    password: str = Field(max_length=128)
