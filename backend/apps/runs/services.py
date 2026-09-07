"""Writing a run, whose runs count, and the claim at sign-in."""

from django.db.models import Count, Q, Sum

from apps.common.devices import device_id
from apps.runs.models import Run


def owned_by(did: str, user=None) -> Q:
    """Whose runs to count. An account spans devices. A device that has not
    signed in sees only its unclaimed runs; without that guard, signing out
    would keep showing the history the account now owns."""
    if user is not None and user.is_authenticated:
        return Q(user=user)
    return Q(device_id=did, user__isnull=True)


def record(did: str, user, payload) -> Run:
    return Run.objects.create(
        device_id=did,
        user=user if user is not None and user.is_authenticated else None,
        topic_text=payload.topic_text,
        genre_slug=payload.genre_slug,
        prep_seconds=payload.prep_seconds,
        speak_seconds=payload.speak_seconds,
        spoken_seconds=payload.spoken_seconds,
        tz_offset=payload.tz_offset,
    )


def totals(did: str, user=None) -> tuple[int, int]:
    """(topics, whole minutes spoken). Minutes floor at 1 so a first, short
    round does not report a proud zero."""
    row = Run.objects.filter(owned_by(did, user)).aggregate(count=Count("id"), seconds=Sum("spoken_seconds"))
    count = row["count"] or 0
    if not count:
        return 0, 0
    return count, max(1, round((row["seconds"] or 0) / 60))


def claim_device(did: str, user) -> int:
    """Every run this device made before it had an account becomes the
    account's. Rows the account already owns, from this device or another,
    are untouched, so a device with anonymous history signing into an
    account with its own history keeps both. Returns how many were claimed."""
    return Run.objects.filter(device_id=did, user__isnull=True).update(user=user)


def claim_on_login(sender, request, user, **kwargs):
    """Django's login signal, so every door claims and none has to remember.
    The device cookie is not rotated here: analytics ride on the device id
    and a sign-in must not split one person into two. Signing out rotates."""
    if request is not None:
        claim_device(device_id(request), user)
