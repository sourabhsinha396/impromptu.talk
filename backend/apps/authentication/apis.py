from ninja import Router

from apps.authentication.schemas import MeOut
from apps.authentication.security import session_auth

api = Router(tags=["auth"])


@api.get("/me", auth=session_auth, response=MeOut)
def me(request):
    """The account behind the session. Every page asks, to draw the menu
    and the footer in their signed-in shape; a stranger is told 401 and
    gets the signed-out shape, which is the answer and not an error."""
    return request.auth
