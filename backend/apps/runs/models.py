"""Runs: one row per finished round, the ledger a streak is counted from.

Streaks are derived from these rows and never stored as a counter; a
counter drifts the first time a timezone, a retry or a clock change
surprises it. `user` is nullable on purpose: a stranger's runs carry only
the device, and signing in claims them by setting `user` on rows that
already exist rather than throwing them away.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

# A round can be set to two hours at most on either side, and the API
# refuses anything longer at the edge; the model states the same ceiling
# so the row can never outgrow the check that protects it.
MAX_SECONDS = 7200

# Minutes east of UTC, and the range a real clock can report.
MAX_OFFSET = 900


class Run(models.Model):
    """Text, not keys, for what was practised: `topic_text` and `genre_slug`
    are copied in, so a run stays readable after a topic is switched off, a
    genre is merged away or an owned genre is deleted. The permalink for
    "recently practised" is looked up by (genre_slug, text) when a page
    needs it, which is unique per genre."""

    device_id = models.CharField(max_length=32, db_index=True)
    # SET_NULL, not CASCADE: deleting an account deletes the account, not
    # the fact that a device practised, which the retention report counts.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="runs"
    )
    topic_text = models.CharField(max_length=200)
    genre_slug = models.CharField(max_length=60, db_index=True)
    prep_seconds = models.PositiveIntegerField()
    speak_seconds = models.PositiveIntegerField()
    # What was actually spoken: finishing early is data, not a failure.
    spoken_seconds = models.PositiveIntegerField()
    # The browser's clock, so the day a run belongs to is the day it was
    # for the person who spoke, whatever the server thinks.
    tz_offset = models.SmallIntegerField(default=0)
    # A default rather than auto_now_add so a test can date a row.
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "runs"
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.topic_text} ({self.created_at:%Y-%m-%d})"
