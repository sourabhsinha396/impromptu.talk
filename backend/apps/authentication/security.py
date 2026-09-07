"""Auth callables for ninja endpoints.

A person authenticates with the session cookie and resolves to a User.
"""

from django.http import Http404
from ninja.security import SessionAuth

# csrf=False on purpose: the browser only reaches this API through the
# frontend's first-party rewrite, so a cross-site POST never carries the
# Lax session cookie. Django admin keeps its own CSRF protection. Pinned
# by a strict-client test, because the regular test client skips CSRF.
session_auth = SessionAuth(csrf=False)


class SuperuserAuth(SessionAuth):
    """The operator's console, and a 404 for everybody else.

    A signed-out stranger, a signed-in speaker and a mistyped path are all
    told the same thing, because a 401 or a 403 confirms the path was
    guessed right. It is an auth callable rather than a check inside each
    route so that it runs before the body is parsed: a 422 from a schema
    would confirm the path just as loudly.
    """

    def authenticate(self, request, key):
        user = super().authenticate(request, key)
        if user is None or not user.is_superuser:
            raise Http404
        return user


superuser_auth = SuperuserAuth()
