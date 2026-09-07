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


class Report(models.Model):
    """What a minute of speaking was like, kept beside the run it describes.

    A table of its own rather than columns on `Run`, because a streak is an
    indexed scan over runs and every byte added there is read by a query
    that wants none of it. Not every run has one either: a round with no
    microphone, or a free account past its transcription allowance, is a
    run with a smaller report or no report at all, and a nullable side
    table says that where fifteen nullable columns would not.

    **The inputs are kept, not just the answers.** `segments` and
    `transcript` are what the numbers were computed from, so a threshold
    that turns out to be wrong can be changed and history recomputed;
    `analysis.AWKWARD_PAUSE` is a guess at where a listener notices a gap
    and it will move once there are real recordings to move it against.
    The scalars below are stored anyway because a year of trend would
    otherwise mean parsing 365 blobs of JSON to draw three lines.

    Audio is never here and never on disk. It goes from the browser
    through the backend to the provider and is dropped, which is what
    keeps "never: audio storage" true with a transcriber behind it.
    """

    run = models.OneToOneField(Run, on_delete=models.CASCADE, related_name="report")
    # [[start, end], ...] in seconds from the top of the round: when sound
    # was present, measured in the browser off the audio envelope.
    segments = models.JSONField(default=list)
    # Empty when nothing transcribed the round, which is a report of timing
    # alone and not a broken one.
    transcript = models.TextField(blank=True)
    # Which service produced the transcript, blank for timing only. Kept
    # because the two tiers use different ones and a filler count from a
    # model that drops fillers would otherwise be indistinguishable.
    provider = models.CharField(max_length=20, blank=True)
    # Seconds of audio actually sent. The allowance is spent in minutes and
    # is summed off this column, so it is here rather than joined from the
    # run: a ten-minute round costs ten times a one-minute round, and
    # counting rounds would undercount spend by that much.
    audio_seconds = models.PositiveIntegerField(default=0)

    opening_stall = models.FloatField(default=0)
    longest_pause = models.FloatField(default=0)
    awkward_pauses = models.PositiveIntegerField(default=0)
    speaking_ratio = models.FloatField(default=0)
    trail_off = models.FloatField(default=0)

    words = models.PositiveIntegerField(default=0)
    pace = models.PositiveIntegerField(default=0)
    fillers = models.PositiveIntegerField(default=0)
    filler_rate = models.FloatField(default=0)
    crutch_words = models.JSONField(default=list)
    filler_words = models.JSONField(default=list)
    # [[word, start, end], ...] in seconds. Returned by the transcriber on
    # every response and once thrown away; kept so a pause can be drawn
    # inside the sentence it interrupted.
    words_at = models.JSONField(default=list)
    # Fillers that landed beside a silence, which is a different problem
    # from saying um a lot and has a different fix.
    fillers_at_transitions = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "run_reports"
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"report on {self.run_id}"

    @property
    def transcribed(self) -> bool:
        """Whether this one spent allowance. A row with no provider cost
        nothing and is not counted against anybody."""
        return bool(self.provider)
