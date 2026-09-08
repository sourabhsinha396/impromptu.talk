from django.test import Client

from apps.authentication.models import User

ME = "/api/v1/auth/me"


def test_a_stranger_is_told_401_and_nothing_else(client):
    response = client.get(ME)
    assert response.status_code == 401
    assert "email" not in response.json()


def test_the_session_owner_gets_their_name_and_the_operator_flag(auth_client, user):
    response = auth_client.get(ME)
    assert response.status_code == 200
    # Pro is a held purchase and nothing else, so a plain account is not
    # one however the shop is configured.
    assert response.json() == {"email": user.email, "name": "", "is_superuser": False, "accent": "", "is_pro": False}


def test_a_superuser_is_told_so(db):
    owner = User.objects.create_superuser("owner@example.com", "correct horse battery", name="Owner")
    signed_in = Client()
    signed_in.force_login(owner)
    body = signed_in.get(ME).json()
    assert body == {"email": "owner@example.com", "name": "Owner", "is_superuser": True, "accent": "", "is_pro": False}
