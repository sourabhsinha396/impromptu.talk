"""Genres and topics: the built-in bank and every genre a person makes.

One pair of tables for both. A built-in genre has no owner; an owned one
(v0's pack) is the same row with an owner set, and its topics are the same
rows under it. The seeder reads only rows without an owner and never
past them, which is the one rule that lets the public bank and private
genres share a table.
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
    built-in genre, a built-in key or the words typed on an owned one. Not
    a foreign key, because the built-ins are a fixed editorial vocabulary
    and a coined one is somebody's own words. `is_active` is the kill
    switch: a dud is switched off, never deleted, so re-adding it later
    cannot trip the unique constraint on text. Text and slug are unique
    per genre, not globally, because two owners may both write the same
    sentence.
    """

    genre = models.ForeignKey(Genre, on_delete=models.CASCADE, related_name="topics")
    text = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    style = models.CharField(max_length=24, db_index=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=100)

    class Meta:
        db_table = "topics"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["genre", "text"], name="topics_genre_text"),
            models.UniqueConstraint(fields=["genre", "slug"], name="topics_genre_slug"),
        ]

    def __str__(self) -> str:
        return self.text
