"""Tongue twisters get a table, and the prompt column gets its width back.

The order is the whole point of writing this one by hand. The table is
created, the read rows walk across, and only then does `topics.text`
narrow to 200: narrowed first, every passage sitting in that column would
have been refused by Postgres (or silently cut by anything that was not
Postgres) while it was still the only place they lived.
"""

import django.db.models.deletion
from django.db import migrations, models

LEVELS = {"easy", "hard"}


def carry_across(apps, schema_editor):
    """Every topic under a read genre becomes a tongue twister, keeping its
    text, its slug and its order. The slug is what `?topic=` resolves on,
    so a link somebody has already sent has to survive this."""
    Genre = apps.get_model("topics", "Genre")
    Topic = apps.get_model("topics", "Topic")
    TongueTwister = apps.get_model("topics", "TongueTwister")
    for genre in Genre.objects.filter(mode="read"):
        rows = Topic.objects.filter(genre=genre).order_by("sort_order", "id")
        TongueTwister.objects.bulk_create(
            [
                TongueTwister(
                    genre=genre,
                    text=row.text,
                    slug=row.slug,
                    # `style` held the difficulty on these rows, which is
                    # the overload this migration exists to end. Anything
                    # else in there was never a difficulty, so it is filed
                    # at the default rather than carried across as junk.
                    level=row.style if row.style in LEVELS else "hard",
                    is_active=row.is_active,
                    sort_order=row.sort_order,
                )
                for row in rows
            ]
        )
        rows.delete()

    # Nothing should be left over 200 characters once the passages are out,
    # because every writer of a prompt already truncated to it. Cut rather
    # than raise: a migration that stops half way is worse than a prompt
    # that loses a tail it was never allowed to have.
    for row in Topic.objects.all():
        if len(row.text) > 200:
            row.text = row.text[:200]
            row.save(update_fields=["text"])


def carry_back(apps, schema_editor):
    Genre = apps.get_model("topics", "Genre")
    Topic = apps.get_model("topics", "Topic")
    TongueTwister = apps.get_model("topics", "TongueTwister")
    for genre in Genre.objects.filter(mode="read"):
        rows = TongueTwister.objects.filter(genre=genre).order_by("sort_order", "id")
        Topic.objects.bulk_create(
            [
                Topic(
                    genre=genre,
                    text=row.text,
                    slug=row.slug,
                    style=row.level,
                    is_active=row.is_active,
                    sort_order=row.sort_order,
                    image="",
                )
                for row in rows
            ]
        )
        rows.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("topics", "0004_genre_mode_alter_topic_text"),
    ]

    operations = [
        migrations.CreateModel(
            name="TongueTwister",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.CharField(max_length=1200)),
                ("slug", models.SlugField(max_length=220)),
                ("level", models.CharField(db_index=True, default="hard", max_length=8)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.IntegerField(default=100)),
                (
                    "genre",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tongue_twisters",
                        to="topics.genre",
                    ),
                ),
            ],
            options={
                "db_table": "tongue_twisters",
                "ordering": ["sort_order", "id"],
                "constraints": [
                    models.UniqueConstraint(fields=("genre", "text"), name="tongue_twisters_genre_text"),
                    models.UniqueConstraint(fields=("genre", "slug"), name="tongue_twisters_genre_slug"),
                ],
            },
        ),
        migrations.RunPython(carry_across, carry_back),
        migrations.AlterField(
            model_name="topic",
            name="text",
            field=models.CharField(max_length=200),
        ),
    ]
