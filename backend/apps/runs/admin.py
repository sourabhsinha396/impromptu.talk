from django.contrib import admin

from apps.runs.models import Run


@admin.register(Run)
class RunAdmin(admin.ModelAdmin):
    """The streak ledger: read, never written by hand. A row can still be
    deleted, because a person may ask for their data to go; nothing else
    about it is edited, or the streak would say something the round did
    not."""

    list_display = ("created_at", "topic_text", "genre_slug", "spoken_seconds", "device_id", "user")
    list_filter = ("genre_slug",)
    search_fields = ("topic_text", "device_id", "user__email")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
