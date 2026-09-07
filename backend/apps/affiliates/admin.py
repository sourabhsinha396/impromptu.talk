from django.contrib import admin

from apps.affiliates.models import Payout


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    """Transfers already made. The tool that writes these with the
    balance in front of it is `/administration` (card 32); this is the
    ledger behind it, and the one place a wrong row is corrected."""

    list_display = ("created_at", "user", "amount", "reference")
    search_fields = ("user__email", "reference")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"

    @admin.display(description="Amount")
    def amount(self, row: Payout) -> str:
        from apps.affiliates import services

        return services.dollars(row.amount_usd_cents)
