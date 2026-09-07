"""The genre table in the owner's console. Own genres land on card 29 and
share by link; the two filters here are what let the owner see what is
being made and what is being passed around."""

from django.test import Client

from apps.authentication.models import User
from tests.unit_tests import factories

GENRES = "/admin/topics/genre/"


def owner_client(db) -> Client:
    owner = User.objects.create_superuser("owner@example.com", factories.PASSWORD)
    client = Client()
    client.force_login(owner)
    return client


def test_the_shared_filter_splits_the_genres_behind_a_link_from_the_rest(db, user):
    client = owner_client(db)
    shared = factories.GenreFactory(name="Interviews", owner=user, share_token="tok")
    private = factories.GenreFactory(name="Weddings", owner=user, share_token=None)

    listed = client.get(GENRES, {"shared": "yes"}).content.decode()
    assert shared.name in listed and private.name not in listed

    listed = client.get(GENRES, {"shared": "no"}).content.decode()
    assert private.name in listed and shared.name not in listed
