from django.contrib import admin

from apps.runs.models import Report, Run


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


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """What a round sounded like, beside the run it describes.

    `provider` is the column worth reading here: blank means the report
    cost nothing and is timing alone, and anything else means the round
    spent allowance, whether or not a transcript came back. That is also
    what `apps/runs/reports.py` sums the monthly ceiling from, so a row
    edited here moves somebody's allowance.
    """

    list_display = ("created_at", "run", "provider", "audio_seconds", "words", "fillers", "opening_stall")
    list_filter = ("provider",)
    search_fields = ("transcript", "run__device_id", "run__user__email")
    raw_id_fields = ("run",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
