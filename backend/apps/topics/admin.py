from django.contrib import admin

from apps.topics.models import Genre, Topic


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "owner", "is_active", "sort_order", "share_token")
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "owner__email")
    ordering = ("sort_order", "id")


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    # The seeder never re-activates a row switched off here: that is what
    # makes this the kill switch and not a suggestion.
    list_display = ("text", "genre", "style", "is_active", "sort_order")
    list_filter = ("genre", "genre__owner", "style", "is_active")
    search_fields = ("text",)
    ordering = ("genre", "sort_order", "id")
