"""Pictures a person uploads for a genre of their own.

Nothing the browser sends is trusted, including the content type: the
bytes are decoded by Pillow, re-encoded to WebP and only then stored, so
what lands in the bucket is an image this process made rather than a
file somebody named `.webp`. Re-encoding is also what drops EXIF, which
is where a phone writes the location a picture was taken.

The column holds a storage key (`uploads/...`) for these and a
site-relative path (`/topics/...`) for the built-in bank, and `url_for`
is the one place that difference is read. A key rather than a full URL,
so moving CDN is a settings change and not a rewrite of every row.
"""

import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from ninja.errors import HttpError
from PIL import Image, UnidentifiedImageError

# The longest side an uploaded picture is kept at. The round draws it at
# 460 CSS pixels, so 1400 is comfortably retina and still small enough
# that a genre of two hundred is not a bill worth thinking about.
MAX_SIDE = 1400

# What the upload route will read off the wire at all. A picture is drawn
# at 460 CSS pixels and stored re-encoded well under this, so a megabyte
# is already more detail than the round can show. A modern phone
# photograph is several megabytes and will not go up untouched, which is
# deliberate: the ceiling is on what the bucket holds per account, not on
# what a camera happens to write.
MAX_BYTES = 1024 * 1024

# Below this in either direction there is nothing to talk about, and it is
# almost always somebody's avatar or a stray icon.
MIN_SIDE = 200

QUALITY = 72

PREFIX = "uploads"

TOO_BIG = "That picture is over 1MB. Try a smaller one."
NOT_AN_IMAGE = "That file is not an image we can read."
TOO_SMALL = f"That picture is smaller than {MIN_SIDE} pixels on a side."


def store(user_id: int, upload) -> str:
    """Validate, re-encode and save. Returns the storage key.

    Raises `HttpError` with a sentence a person can act on, because every
    one of these is something they can fix by picking another file.
    """
    if upload.size > MAX_BYTES:
        raise HttpError(400, TOO_BIG)
    try:
        image = Image.open(upload)
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HttpError(400, NOT_AN_IMAGE) from exc

    if min(image.size) < MIN_SIDE:
        raise HttpError(400, TOO_SMALL)

    # Transparency and palettes flattened onto white: WebP would keep an
    # alpha channel, and the round draws the picture on the page's own
    # background, where a transparent hole reads as a broken file.
    if image.mode not in ("RGB", "L"):
        flattened = Image.new("RGB", image.size, (255, 255, 255))
        flattened.paste(image, mask=image.convert("RGBA").split()[-1] if "A" in image.mode else None)
        image = flattened
    image = image.convert("RGB")
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)

    buffer = ContentFile(b"")
    image.save(buffer, "WEBP", quality=QUALITY, method=4)
    buffer.seek(0)

    key = f"{PREFIX}/{user_id}/{uuid.uuid4().hex}.webp"
    return default_storage.save(key, buffer)


def remove(key: str) -> None:
    """Delete the object behind a key, if it is one of ours.

    A missing object is not an error: the row is going either way, and a
    delete that fails because the file already went would leave somebody
    unable to tidy their own genre.
    """
    if not key or not key.startswith(f"{PREFIX}/"):
        return
    try:
        default_storage.delete(key)
    except Exception:  # noqa: BLE001 - the row is going regardless
        pass


def url_for(image: str) -> str:
    """What goes in an `img` tag.

    A built-in's `/topics/...` is already a path the frontend serves and
    is handed back untouched; an upload's key is resolved by whichever
    storage is configured, which is the bucket's CDN in production and a
    path under MEDIA_URL anywhere without one.
    """
    if not image or image.startswith("/") or image.startswith("http"):
        return image
    try:
        return default_storage.url(image)
    except Exception:  # noqa: BLE001 - a broken picture must not break the list
        return f"{settings.MEDIA_URL}{image}"
