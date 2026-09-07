from django.contrib import admin

from apps.administration.models import Outreach


@admin.register(Outreach)
class OutreachAdmin(admin.ModelAdmin):
    """Who the pitch has gone to. The console writes these; this is where
    a duplicate or a typo is corrected."""

    list_display = ("created_at", "name", "url")
    search_fields = ("name", "url")
    date_hierarchy = "created_at"
