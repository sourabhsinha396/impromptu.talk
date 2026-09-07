"""The ninja surface takes a session POST without a CSRF token and the
admin does not. Pinned with a strict client, because the regular test
client skips CSRF checks and would pass either way.

The probe route lives in this module rather than in the app: there is no
session POST on the API yet, and a throwaway endpoint shipped for a test
would be one more thing on the site.
"""

from django.contrib import admin
from django.test import Client, override_settings
from django.urls import path
from ninja import NinjaAPI, Router

from apps.authentication.security import session_auth, superuser_auth

probe = Router()


@probe.post("/probe", auth=session_auth)
def probe_post(request):
    return {"email": request.auth.email}


@probe.post("/console", auth=superuser_auth)
def console_post(request):
    return {"email": request.auth.email}


probe_api = NinjaAPI(urls_namespace="csrf_probe")
probe_api.add_router("", probe)

urlpatterns = [path("api/", probe_api.urls), path("re-admin/", admin.site.urls)]


@override_settings(ROOT_URLCONF=__name__)
def test_a_session_post_needs_no_csrf_token(user):
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(user)
    response = strict.post("/api/probe")
    assert response.status_code == 200
    assert response.json() == {"email": user.email}


@override_settings(ROOT_URLCONF=__name__)
def test_a_stranger_is_still_refused(db):
    strict = Client(enforce_csrf_checks=True)
    assert strict.post("/api/probe").status_code == 401


@override_settings(ROOT_URLCONF=__name__)
def test_the_admin_keeps_csrf(db):
    strict = Client(enforce_csrf_checks=True)
    response = strict.post("/re-admin/login/", {"username": "owner@example.com", "password": "x"})
    assert response.status_code == 403


@override_settings(ROOT_URLCONF=__name__)
def test_the_operator_console_takes_a_session_post_too(db):
    """The console's own auth is a second `SessionAuth`, and ninja's
    default turns CSRF on. It shipped that way for an hour: every POST
    from the browser answered "CSRF check Failed" while this suite stayed
    green, because the ordinary test client skips the check."""
    from tests.unit_tests import factories

    boss = factories.UserFactory(email="boss@example.com", is_staff=True, is_superuser=True)
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(boss)
    assert strict.post("/api/console").status_code == 200


@override_settings(ROOT_URLCONF=__name__)
def test_the_console_is_a_404_to_everybody_else_even_without_a_token(user):
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(user)
    assert strict.post("/api/console").status_code == 404
