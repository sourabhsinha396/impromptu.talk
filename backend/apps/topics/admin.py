from django.contrib import admin

from apps.topics.models import Generation, Genre, Topic


class Shared(admin.SimpleListFilter):
    """Whether a genre is behind a link. `share_token` is either a token
    or nothing, so the useful question is which of the two, not which
    token: a filter listing every token would be one row per genre."""

    title = "shared"
    parameter_name = "shared"

    def lookups(self, request, model_admin):
        return (("yes", "Shared"), ("no", "Not shared"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(share_token=None)
        if self.value() == "no":
            return queryset.filter(share_token=None)
        return queryset


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    """The bank's own genres and the ones people make (card 29), in one
    table because they are one table. The owner and shared filters are
    what let the owner see what is being made and what is being passed
    around, without a second console for it."""

    list_display = ("name", "slug", "icon", "owner", "is_active", "sort_order", "share_token")
    list_filter = ("is_active", "owner", Shared)
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


@admin.register(Generation)
class GenerationAdmin(admin.ModelAdmin):
    """What the model was asked and what it cost, which is the only place
    the spend is visible before the provider's own dashboard."""

    list_display = ("created_at", "user", "genre", "prompt", "model", "topics", "completion_tokens", "error")
    list_filter = ("model",)
    search_fields = ("prompt", "user__email", "error")
    raw_id_fields = ("user", "genre")
    date_hierarchy = "created_at"
