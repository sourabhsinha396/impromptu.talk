from django.contrib import admin

from apps.runs.models import Run


@admin.register(Run)
class RunAdmin(admin.ModelAdmin):
    """The streak ledger, open to the owner like every other table: a row
    can be added, edited or deleted by hand. The streak is derived from
    these rows on every read, so an edit here is the streak's truth from
    that moment on."""

    list_display = ("created_at", "topic_text", "genre_slug", "spoken_seconds", "device_id", "user")
    list_filter = ("genre_slug",)
    search_fields = ("topic_text", "device_id", "user__email")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
