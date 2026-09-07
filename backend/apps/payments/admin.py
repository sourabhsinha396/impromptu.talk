from django.contrib import admin

from apps.payments.models import Purchase


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    """The money ledger, open to the owner like every other table. The
    full console lands on card 28; what is here is enough to read a row
    and correct one by hand.

    The quote and the charge sit side by side in the list on purpose: a
    product drifted at the provider shows up as two columns disagreeing,
    which is the one thing nobody would otherwise notice.
    """

    list_display = ("created_at", "reference", "user", "plan", "status", "quoted", "charged", "expires_at")
    list_filter = ("status", "plan", "currency")
    search_fields = ("reference", "user__email", "payment_id", "subscription_id", "customer_id")
    raw_id_fields = ("user", "referrer")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    @admin.display(description="Quoted")
    def quoted(self, row: Purchase) -> str:
        from apps.payments import pricing

        return pricing.display(row.amount_minor, row.currency)

    @admin.display(description="Charged")
    def charged(self, row: Purchase) -> str:
        from apps.payments import pricing

        if row.charged_minor is None:
            return "-"
        return pricing.display(row.charged_minor, row.charged_currency or "")
