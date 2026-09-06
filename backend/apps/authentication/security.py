"""Auth callables for ninja endpoints.

A person authenticates with the session cookie and resolves to a User.
"""

from ninja.security import SessionAuth

# csrf=False on purpose: the browser only reaches this API through the
# frontend's first-party rewrite, so a cross-site POST never carries the
# Lax session cookie. Django admin keeps its own CSRF protection. Pinned
# by a strict-client test, because the regular test client skips CSRF.
session_auth = SessionAuth(csrf=False)
