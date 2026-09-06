"""The device cookie: issued on first API contact, kept while it is
honest, replaced when it is not, rewritten after a rotation."""

from django.http import HttpResponse
from django.test import RequestFactory

from apps.common import devices

HEALTH = "/api/v1/common/health"


def unsign(cookie):
    """Read a cookie back the way the app does; a forged one raises."""
    request = RequestFactory().get(HEALTH)
    request.COOKIES[devices.DEVICE_COOKIE] = cookie.value
    return request.get_signed_cookie(devices.DEVICE_COOKIE)


def test_first_api_contact_issues_a_signed_device_cookie(client):
    response = client.get(HEALTH)
    cookie = response.cookies[devices.DEVICE_COOKIE]
    assert len(unsign(cookie)) == 32
    assert cookie["httponly"]
    assert cookie["samesite"] == "Lax"
    assert int(cookie["max-age"]) == 60 * 60 * 24 * 730


def test_an_honest_cookie_is_kept_and_not_reissued(client):
    first = client.get(HEALTH).cookies[devices.DEVICE_COOKIE]
    second = client.get(HEALTH)
    assert devices.DEVICE_COOKIE not in second.cookies
    assert client.cookies[devices.DEVICE_COOKIE].value == first.value


def test_a_forged_cookie_is_replaced_with_a_fresh_id(client):
    client.cookies[devices.DEVICE_COOKIE] = "someone-elses-id"
    response = client.get(HEALTH)
    assert unsign(response.cookies[devices.DEVICE_COOKIE]) != "someone-elses-id"


def test_an_edited_signed_cookie_is_replaced_too(client):
    honest = client.get(HEALTH).cookies[devices.DEVICE_COOKIE].value
    original = unsign(client.cookies[devices.DEVICE_COOKIE])
    client.cookies[devices.DEVICE_COOKIE] = "f" * 32 + honest[32:]
    response = client.get(HEALTH)
    assert unsign(response.cookies[devices.DEVICE_COOKIE]) not in (original, "f" * 32)


def test_the_admin_does_not_carry_it(client):
    response = client.get("/re-admin/login/")
    assert devices.DEVICE_COOKIE not in response.cookies


def test_the_id_is_memoised_within_a_request():
    request = RequestFactory().get(HEALTH)
    assert devices.device_id(request) == devices.device_id(request)


def test_a_rotation_reaches_the_cookie():
    request = RequestFactory().get(HEALTH)
    before = devices.device_id(request)

    def sign_out(request):
        devices.rotate_device(request)
        return HttpResponse()

    response = devices.DeviceCookieMiddleware(sign_out)(request)
    after = unsign(response.cookies[devices.DEVICE_COOKIE])
    assert after != before
    assert after == devices.device_id(request)


def test_the_flags_follow_the_session_cookie(settings):
    settings.SESSION_COOKIE_SECURE = True
    request = RequestFactory().get(HEALTH)
    response = devices.DeviceCookieMiddleware(lambda request: HttpResponse())(request)
    assert response.cookies[devices.DEVICE_COOKIE]["secure"]
