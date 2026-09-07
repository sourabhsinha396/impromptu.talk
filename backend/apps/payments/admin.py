from django.contrib import admin

from apps.payments import checkout
from apps.payments.models import Purchase


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    """The money ledger, open to the owner like every other table.

    The quote and the charge sit side by side in the list on purpose: a
    product drifted at the provider shows up as two columns disagreeing,
    which is the one thing nobody would otherwise notice.

    A refund is this edit and nothing else. There is no `refund()` verb
    anywhere in the codebase, because the money goes back in the
    provider's dashboard and no button here can do that; what this row
    records is that it happened, which is what pulls the access. The
    channel hears about it once, on the flip.
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

    def save_model(self, request, obj, form, change) -> None:
        """Announce a refund exactly once: on the edit that flips a paid
        row to refunded, and never on a later save of a row that was
        already refunded, or the channel gets a second refund every time
        somebody opens the page to read it."""
        became_refunded = (
            change and obj.status == Purchase.REFUNDED and form.initial.get("status") == Purchase.PAID
        )
        super().save_model(request, obj, form, change)
        if became_refunded:
            checkout.announce_refund(obj)
