"""The settings pages' own routes: the name, the colour and the password.

What is pinned here is what would break silently: a password change that
locked out the browser that made it, a colour that reached an attribute on
<html> as whatever was typed, and a settings payload carrying the hash.
"""

from django.test import Client, override_settings

from apps.authentication.models import User
from apps.authentication.services import PRO_ONLY, TOO_SHORT, WRONG_PASSWORD
from tests.unit_tests import factories

ACCOUNT = "/api/v1/auth/account"
NAME = "/api/v1/auth/name"
ACCENT = "/api/v1/auth/accent"
PASSWORD = "/api/v1/auth/password"
ME = "/api/v1/auth/me"
JSON = "application/json"


def test_the_settings_payload_says_a_password_exists_and_never_what_it_is(auth_client, user):
    body = auth_client.get(ACCOUNT).json()
    assert body == {
        "email": user.email,
        "name": "",
        "accent": "",
        "has_password": True,
        "share_token": None,
        # Nothing is for sale in a test run, so Pro's features are open to
        # everybody and no plan is held.
        "is_pro": True,
        "plan": None,
    }


def test_a_google_only_account_is_told_it_has_no_password(db):
    google = factories.UserFactory(email="sam@example.com", password="", google_sub="g-1")
    client = Client()
    client.force_login(google)
    assert client.get(ACCOUNT).json()["has_password"] is False


def test_a_name_can_be_tidied_and_taken_back(auth_client, user):
    auth_client.patch(NAME, {"name": "  Ada   Grace "}, content_type=JSON)
    user.refresh_from_db()
    assert user.name == "Ada Grace"
    # Blank is a value, not a missing one: a name is optional at signup,
    # so one typed once has to be removable.
    auth_client.patch(NAME, {"name": ""}, content_type=JSON)
    user.refresh_from_db()
    assert user.name == ""


def test_a_colour_nobody_offers_becomes_the_default(auth_client, user):
    auth_client.patch(ACCENT, {"accent": "violet"}, content_type=JSON)
    user.refresh_from_db()
    assert user.accent == "violet"
    # This value is rendered into an attribute on <html>. Anything but one
    # of the six is stored as blank, which is the default lime.
    auth_client.patch(ACCENT, {"accent": '" onload="'}, content_type=JSON)
    user.refresh_from_db()
    assert user.accent == ""


def test_the_settings_routes_are_shut_to_strangers(client, db):
    assert client.get(ACCOUNT).status_code == 401
    assert client.patch(NAME, {"name": "Mallory"}, content_type=JSON).status_code == 401
    assert client.patch(ACCENT, {"accent": "coral"}, content_type=JSON).status_code == 401
    assert client.post(PASSWORD, {"password": "a new long one"}, content_type=JSON).status_code == 401


def test_changing_the_password_ends_the_other_browsers_and_keeps_this_one(auth_client, user):
    elsewhere = Client()
    elsewhere.force_login(user)
    body = {"current": factories.PASSWORD, "password": "a new long password"}
    assert auth_client.post(PASSWORD, body, content_type=JSON).status_code == 200
    # The browser that just proved it holds the account is the one thing
    # this must not sign out.
    assert auth_client.get(ME).status_code == 200
    assert elsewhere.get(ME).status_code == 401
    assert User.objects.get(pk=user.pk).check_password("a new long password")


def test_the_current_password_has_to_be_right(auth_client, user):
    body = {"current": "not it", "password": "a new long password"}
    response = auth_client.post(PASSWORD, body, content_type=JSON)
    assert response.status_code == 400
    assert response.json()["detail"] == WRONG_PASSWORD
    assert User.objects.get(pk=user.pk).check_password(factories.PASSWORD)


def test_a_short_new_password_is_refused_with_a_sentence(auth_client, user):
    body = {"current": factories.PASSWORD, "password": "short"}
    response = auth_client.post(PASSWORD, body, content_type=JSON)
    assert response.status_code == 400
    assert response.json()["detail"] == TOO_SHORT


def test_a_google_only_account_sets_its_first_password_without_confirming_one(db):
    google = factories.UserFactory(email="sam@example.com", password="", google_sub="g-2")
    client = Client()
    client.force_login(google)
    assert client.post(PASSWORD, {"password": "a first real password"}, content_type=JSON).status_code == 200
    google.refresh_from_db()
    # Google keeps working: the second door is added, not swapped in.
    assert google.check_password("a first real password")
    assert google.google_sub == "g-2"


@override_settings(DODO_API_KEY="live", DODO_PRODUCTS={"lifetime": "prod_l"})
def test_the_colour_is_refused_to_an_account_without_pro(auth_client, user):
    # Everybody may look at all six; keeping one is what is bought. The
    # refusal lives here as well as in the page, or the gate is decoration.
    response = auth_client.patch(ACCENT, {"accent": "violet"}, content_type=JSON)
    assert response.status_code == 400
    assert response.json()["detail"] == PRO_ONLY
    user.refresh_from_db()
    assert user.accent == ""

    factories.PurchaseFactory(user=user, plan="lifetime")
    assert auth_client.patch(ACCENT, {"accent": "violet"}, content_type=JSON).status_code == 200
    user.refresh_from_db()
    assert user.accent == "violet"
