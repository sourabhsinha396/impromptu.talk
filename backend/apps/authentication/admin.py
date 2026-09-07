from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.authentication.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """The owner's console over the account, and it holds nothing back:
    every column is editable here, the operator flags included, because
    this is the one door those flags are meant to be raised through.
    Django's own user admin underneath, for its password-change form and
    the hashed field it draws in place of the raw hash. `created_at` is
    auto_now_add and so read-only by the model, not by choice here."""

    list_display = ("email", "name", "is_staff", "is_superuser", "is_active", "affiliate_code", "created_at")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("email", "name", "affiliate_code", "google_sub", "share_token")
    raw_id_fields = ("referred_by",)
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password", "name")}),
        ("Flags", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Account", {"fields": ("accent", "google_sub", "share_token")}),
        ("Affiliates", {"fields": ("affiliate_code", "referred_by", "paypal_email")}),
        ("Dates", {"fields": ("last_login", "created_at")}),
        ("Permissions", {"classes": ("collapse",), "fields": ("groups", "user_permissions")}),
    )
    add_fieldsets = (
        (
            None,
            {"classes": ("wide",), "fields": ("email", "password1", "password2", "name", "is_staff", "is_superuser")},
        ),
    )
