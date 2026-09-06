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

from apps.authentication.security import session_auth

probe = Router()


@probe.post("/probe", auth=session_auth)
def probe_post(request):
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
