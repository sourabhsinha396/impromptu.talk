"""The admin is the one door the operator flags are raised through, and
it holds nothing back: pinned, because the same day's first cut locked
the run table and the owner asked for the opposite."""

from django.test import Client

from apps.authentication.models import User
from apps.runs.models import Run
from tests.unit_tests import factories


def owner_client(db):
    owner = User.objects.create_superuser("owner@example.com", factories.PASSWORD)
    client = Client()
    client.force_login(owner)
    return client, owner


def test_the_owner_can_raise_the_operator_flags_from_the_admin(db, user):
    client, _ = owner_client(db)
    page = client.get(f"/admin/authentication/user/{user.pk}/change/")
    assert page.status_code == 200
    assert 'name="is_superuser"' in page.content.decode()
    response = client.post(
        f"/admin/authentication/user/{user.pk}/change/",
        {
            "email": user.email,
            "name": "Priya",
            "is_active": "on",
            "is_staff": "on",
            "is_superuser": "on",
            "accent": "",
            "google_sub": "",
            "share_token": "",
            "affiliate_code": "",
            "referred_by": "",
            "paypal_email": "",
            "last_login_0": "",
            "last_login_1": "",
            "_save": "Save",
        },
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.is_superuser and user.is_staff and user.name == "Priya"


def test_a_run_can_be_added_and_edited_by_hand(db):
    client, owner = owner_client(db)
    assert client.get("/admin/runs/run/add/").status_code == 200
    run = factories.RunFactory()
    page = client.get(f"/admin/runs/run/{run.pk}/change/")
    assert page.status_code == 200
    assert 'name="spoken_seconds"' in page.content.decode()
    assert Run.objects.count() == 1
