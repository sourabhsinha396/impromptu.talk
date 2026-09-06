from ninja import Schema


class MeOut(Schema):
    """Who is signed in, as the chrome needs it: what to call them, and
    whether the operator door shows. Nothing else about the account leaves
    the server on this route."""

    email: str
    name: str
    is_superuser: bool
