"""Pictures somebody uploads for a genre of their own.

The upload is the one route that takes bytes off the wire, so what is
pinned here is what it refuses, what it stores, and the two rules that
keep it off the public internet: a genre holding a picture cannot be
shared, and a shared genre will not take one.
"""

import io

import pytest
from django.core.files.storage import default_storage
from django.test import Client
from PIL import Image

from apps.topics import owned
from apps.topics.models import Genre, Topic
from tests.unit_tests import factories

MINE = "/api/v1/topics/mine"
JSON = "application/json"


def photo(size=(900, 700), fmt="JPEG", colour=(40, 90, 140)) -> io.BytesIO:
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, fmt)
    buffer.seek(0)
    buffer.name = f"photo.{fmt.lower()}"
    return buffer


@pytest.fixture
def pro(user):
    factories.PurchaseFactory(user=user, plan="lifetime")
    signed_in = Client()
    signed_in.force_login(user)
    return signed_in


@pytest.fixture
def genre(pro):
    pro.post(MINE, {"name": "My pictures", "icon": "mic"}, content_type=JSON)
    return "my-pictures"


def upload(client, slug, file, text="The kitchen table", style=""):
    return client.post(f"{MINE}/{slug}/pictures", {"picture": file, "text": text, "style": style})


def test_an_uploaded_picture_becomes_a_topic_with_a_url_to_draw(pro, genre):
    response = upload(pro, genre, photo())
    assert response.status_code == 201
    body = response.json()
    assert body["has_pictures"] is True
    topic = body["topics"][0]
    assert topic["text"] == "The kitchen table"
    # What the row holds is a key; what the route hands back is something
    # an `img` tag can use. The two are deliberately not the same.
    stored = Topic.objects.get(id=topic["id"]).image
    assert stored.startswith("uploads/")
    assert topic["image"].endswith(".webp") and topic["image"] != stored
    assert default_storage.exists(stored)


def test_whatever_arrives_is_re_encoded_to_webp_and_capped(pro, genre):
    """The bytes are decoded and written again by this process, which is
    what proves they were an image and is also what drops the EXIF a
    phone writes the location into."""
    from apps.topics import pictures

    upload(pro, genre, photo(size=(3000, 2000), fmt="PNG"))
    stored = Topic.objects.exclude(image="").get().image
    with default_storage.open(stored) as handle:
        written = Image.open(io.BytesIO(handle.read()))
    assert written.format == "WEBP"
    assert max(written.size) == pictures.MAX_SIDE


def test_a_picture_over_the_ceiling_is_refused_on_its_size_alone(pro, genre):
    """Asked of the size, not the bytes, so a big file is cheap to say no
    to. The browser shrinks a camera roll picture under this before it
    sends anything, and this is the wall behind that."""
    from apps.topics import pictures

    big = io.BytesIO(b"x" * (pictures.MAX_BYTES + 1))
    big.name = "photo.jpg"
    response = upload(pro, genre, big)
    assert response.status_code == 400
    assert response.json()["detail"] == pictures.TOO_BIG
    assert not Topic.objects.exclude(image="").exists()


def test_a_file_that_is_not_an_image_is_refused_whatever_it_is_called(pro, genre):
    """The content type is the browser's claim, not evidence. Pillow
    failing to decode it is the evidence."""
    rubbish = io.BytesIO(b"MZ\x90\x00 this is an executable, honestly")
    rubbish.name = "photo.jpg"
    response = upload(pro, genre, rubbish)
    assert response.status_code == 400
    assert response.json()["detail"] == "That file is not an image we can read."
    assert not Topic.objects.exclude(image="").exists()


def test_something_too_small_to_talk_about_is_refused(pro, genre):
    response = upload(pro, genre, photo(size=(64, 64)))
    assert response.status_code == 400
    assert "pixels on a side" in response.json()["detail"]


def test_a_genre_holding_a_picture_cannot_be_shared(pro, genre):
    """`/g/<token>` needs no account, so sharing one would make this a
    place to host arbitrary images behind a link (owner's call)."""
    upload(pro, genre, photo())
    response = pro.post(f"{MINE}/{genre}/share")
    assert response.status_code == 400
    assert response.json()["detail"] == owned.PICTURES_NO_SHARING
    assert pro.get(f"{MINE}/{genre}").json()["share_token"] is None


def test_a_shared_genre_will_not_take_a_picture(pro, genre):
    """The other direction of the same rule, or sharing first would be
    the way around it."""
    assert pro.post(f"{MINE}/{genre}/share").status_code == 200
    response = upload(pro, genre, photo())
    assert response.status_code == 400
    assert response.json()["detail"] == owned.SHARED_NO_PICTURES
    assert not Topic.objects.exclude(image="").exists()


def test_deleting_the_topic_deletes_the_file(pro, genre):
    """Or a cancelled subscriber's bucket grows forever with pictures
    nothing points at."""
    topic = upload(pro, genre, photo()).json()["topics"][0]
    stored = Topic.objects.get(id=topic["id"]).image
    assert default_storage.exists(stored)
    assert pro.delete(f"{MINE}/{genre}/topics/{topic['id']}").status_code == 200
    assert not default_storage.exists(stored)


def test_deleting_the_genre_takes_its_uploads_with_it(pro, genre):
    upload(pro, genre, photo(), text="One")
    upload(pro, genre, photo(colour=(200, 40, 40)), text="Two")
    keys = list(Topic.objects.exclude(image="").values_list("image", flat=True))
    assert len(keys) == 2
    assert pro.delete(f"{MINE}/{genre}").status_code == 204
    assert [k for k in keys if default_storage.exists(k)] == []


def test_uploading_is_pro_only_like_every_other_write(user, genre):
    """The genre exists because the fixture made it while Pro was held;
    what closes when Pro lapses is writing more into it."""
    from apps.payments.models import Purchase

    Purchase.objects.filter(user=user).delete()
    lapsed = Client()
    lapsed.force_login(user)
    response = upload(lapsed, genre, photo())
    assert response.status_code == 403
    assert response.json()["detail"] == owned.PRO_ONLY


def test_a_warm_up_takes_no_picture_whatever_this_route_is_asked(pro):
    """The hole the shared table left open, and the reason a passage has a
    table of its own. The editor never drew the control here, and the route
    refused nothing: a picture posted at a read genre landed as a
    200-character `Topic` row underneath it, counted against the prompt cap
    of two hundred rather than the fifty passages that genre is held to,
    and nothing anywhere drew it. `image` is a column on the other table
    now, so the refusal is the route saying what the schema already says."""
    pro.post(MINE, {"name": "My twisters", "icon": "mic", "mode": "read"}, content_type=JSON)
    response = upload(pro, "my-twisters", photo(), text="A picture over a passage")
    assert response.status_code == 400
    assert response.json()["detail"] == owned.READ_NO_PICTURES
    genre = Genre.objects.get(slug="my-twisters")
    assert not genre.topics.exists()
    assert not genre.tongue_twisters.exists()
