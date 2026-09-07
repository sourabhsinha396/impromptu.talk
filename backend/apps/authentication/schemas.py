from ninja import Schema
from pydantic import Field


class MeOut(Schema):
    """Who is signed in, as the chrome needs it: what to call them, and
    whether the operator door shows. Nothing else about the account leaves
    the server on this route."""

    email: str
    name: str
    is_superuser: bool


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


class LoginIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class ForgotIn(Schema):
    email: str = Field(max_length=254)


class ResetIn(Schema):
    # Longer than a token can be and shorter than anything a script would
    # try; the shape is checked by Django's own generator.
    token: str = Field(max_length=200)
    password: str = Field(max_length=128)
