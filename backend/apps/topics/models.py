"""Genres and what hangs under them: the built-in bank and everything a
person writes for themselves.

One `Genre` table for both, built-in and owned. A built-in genre has no
owner; an owned one (v0's pack) is the same row with an owner set. The
seeder reads only rows without an owner and never past them, which is the
one rule that lets the public bank and private genres share a table.

Two kinds of row hang underneath, and they are two tables because they are
two things: a `Topic` is a prompt you are asked to talk about, a
`TongueTwister` is a paragraph you read aloud verbatim. `Genre.mode` says
which kind a genre holds, and it is the only place the two meet.
"""

from django.conf import settings
from django.db import models

from apps.topics.icons import DEFAULT_ICON


class Genre(models.Model):
    """One subject: what a topic is about, and the picker's only axis.

    Slug is unique among built-ins and unique per owner otherwise, so two
    people can both have "work" and nobody can shadow a built-in.
    `share_token` is the whole of sharing: null means private.
    """

    slug = models.SlugField(max_length=60)
    name = models.CharField(max_length=60)
    icon = models.CharField(max_length=32, default=DEFAULT_ICON)
    blurb = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=100)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="genres"
    )
    share_token = models.CharField(max_length=32, null=True, blank=True, unique=True)
    # How this genre is practised: `speak` is a prompt you talk about,
    # `read` is a warm-up passage you read aloud off a scroller. One column
    # rather than a second round: the prep phase is skipped and the clock
    # becomes the scroll, and everything else about the round is unchanged
    # (docs/DECISIONS.md). Defaulted, so every existing row is a speak row.
    mode = models.CharField(max_length=8, default="speak")

    class Meta:
        db_table = "genres"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["slug"], condition=models.Q(owner__isnull=True), name="genres_builtin_slug"
            ),
            models.UniqueConstraint(fields=["owner", "slug"], name="genres_owner_slug"),
        ]

    @property
    def built_in(self) -> bool:
        return self.owner_id is None

    def __str__(self) -> str:
        return self.name


class Topic(models.Model):
    """One prompt: the thing a person is actually asked to talk about.

    `style` is how they are asked to talk about it: a built-in key on a
    built-in genre, a built-in key or the words typed on an owned one. One
    vocabulary, because a passage's difficulty lives on `TongueTwister`
    rather than in here. Not a foreign key, because the built-ins are a
    fixed editorial vocabulary and a coined one is somebody's own words. `is_active` is the kill
    switch: a dud is switched off, never deleted, so re-adding it later
    cannot trip the unique constraint on text. Text and slug are unique
    per genre, not globally, because two owners may both write the same
    sentence.
    """

    genre = models.ForeignKey(Genre, on_delete=models.CASCADE, related_name="topics")
    # The prompt ceiling, and back at 200 now that passages have a table of
    # their own. It was widened to 1200 to hold them, and the width was the
    # bug: `bank.load`, the owned paste and the edit schema each had to
    # re-state the real rule, and each was found missing it separately. A
    # prompt is a sentence, and the column says so again.
    text = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    style = models.CharField(max_length=24, db_index=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=100)
    # A picture as well as a sentence: `image` is what makes a topic one, not
    # a separate row kind or table (docs/DECISIONS.md, 2026-09-09). Empty is
    # the whole of "not a picture topic". `text` stays the prompt in both
    # kinds, which is what keeps a picture round the same round: the same
    # sentence is shown, recorded and read back, with a picture over it.
    # A CharField and not a URLField because a built-in holds a site-relative
    # path (`/topics/castle-in-mist.webp`), which URLValidator rejects; an
    # uploaded one will hold an absolute URL, and both belong in this column.
    image = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "topics"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["genre", "text"], name="topics_genre_text"),
            models.UniqueConstraint(fields=["genre", "slug"], name="topics_genre_slug"),
        ]

    def __str__(self) -> str:
        return self.text


class TongueTwister(models.Model):
    """One passage: a paragraph somebody reads aloud off the scroller.

    A table of its own rather than a `Topic` under a genre with a mode,
    which is what the first cut did (docs/DECISIONS.md). A prompt is a
    sentence you are asked to talk about and a passage is a paragraph you
    read verbatim, and every column the two shared had to mean two things
    to hold both: `style` was a speaking style on one row and a difficulty
    on the next, `text` carried one width for two different ceilings, and
    `image` was dead on every passage. The prompt ceiling leaked into three
    places while they shared a column, each one found as its own bug.

    The genre above stays shared, because none of that is doubled there: an
    owner, a share token, the ten-genre cap and the picker mean the same
    thing whichever kind of row hangs underneath.
    """

    genre = models.ForeignKey(Genre, on_delete=models.CASCADE, related_name="tongue_twisters")
    # A paragraph: 100 to 120 words, which is 40 to 60 seconds of reading
    # aloud at the speeds the scroller offers. `bank.MIN_PASSAGE` and
    # `bank.MAX_PASSAGE` are the real bounds and this is the guard behind
    # them, nowhere near a prompt's 200.
    text = models.CharField(max_length=1200)
    # Named in the file rather than slugified from the text: slugifying 700
    # characters gives 220 characters of the first sentence, which is no
    # use in a link somebody is meant to paste. Written once, because
    # `/tongue-twisters?topic=` resolves on it.
    slug = models.SlugField(max_length=220)
    # Difficulty, and the whole of what a passage carries: nobody chooses
    # how to say words they are reading verbatim. Two values from a fixed
    # set (`bank.LEVEL_KEYS`), never coined, which is the other half of why
    # this is not `Topic.style`. Speed is what actually makes a passage
    # hard; this is a label on the writing.
    level = models.CharField(max_length=8, default="hard", db_index=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=100)

    class Meta:
        db_table = "tongue_twisters"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["genre", "text"], name="tongue_twisters_genre_text"),
            models.UniqueConstraint(fields=["genre", "slug"], name="tongue_twisters_genre_slug"),
        ]

    @property
    def words(self) -> int:
        return len(self.text.split())

    def __str__(self) -> str:
        return self.text[:60]


class Generation(models.Model):
    """One ask of the model, kept whether or not it produced anything.

    The row is the ceiling. The allowance is counted from these rather
    than held as a column, for the reason the streak gives at length: a
    stored count drifts the first time a retry or a clock change
    surprises it. A failed call keeps its row too, with the reason in
    `error` and no topics, because an account that can retry a failure
    for free has no ceiling at all.

    The genre is SET_NULL rather than CASCADE: deleting a genre must not
    delete the evidence of what it cost to fill.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="generations")
    genre = models.ForeignKey(Genre, null=True, blank=True, on_delete=models.SET_NULL, related_name="generations")
    prompt = models.CharField(max_length=300)
    model = models.CharField(max_length=80, blank=True)
    topics = models.PositiveIntegerField(default=0)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "generations"
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"{self.prompt[:40]} ({self.topics} topics)"
