"""One trip through checkout, kept whether or not it ended in money."""

from django.db import models


class Purchase(models.Model):
    """One trip through checkout, kept whether or not money moved.

    Append-only in code and never deleted, the failures included: a row
    saying somebody tried to pay and did not is the only thing that
    explains a support email, and a deleted one explains nothing. `status`
    moves pending to paid or failed, and paid to refunded when access is
    pulled after a refund issued at the provider.

    `reference` is ours and is minted before the provider is called: it
    travels in the checkout metadata and in the return URL, and matching
    it on the way back is half of what proves an arriving payment belongs
    to this row. The other half is `session_id`. `payment_id` is not known
    until then, because a hosted checkout becomes a payment only once
    somebody pays it.

    The quote columns are frozen at checkout time on purpose. Rates move,
    the multiplier table gets edited, and neither may quietly rewrite what
    a receipt from last March says. `plan` is frozen for the same reason:
    what somebody bought is a fact about the day they bought it.

    Those columns are the quote, and a quote is not a receipt. What the
    card was charged is `charged_minor` and `charged_currency`, read back
    off the payment. Keeping both is what lets a mismatch be visible
    instead of hidden or fatal: the two disagreeing is a product
    configured wrong, which is an operator's problem, never the buyer's.

    `status` says whether the money landed. `expires_at` says whether the
    access it bought is still good, and the two are independent: a paid
    subscription whose renewal failed is still paid, and its entitlement
    has simply run out.
    """

    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    # A plain vocabulary this app owns, as `Topic.style` is: a CHECK
    # constraint to migrate every time it grows buys nothing here.
    STATUSES = [(PENDING, "Pending"), (PAID, "Paid"), (FAILED, "Failed"), (REFUNDED, "Refunded")]

    reference = models.CharField(max_length=32, unique=True)
    # PROTECT, not CASCADE: deleting an account that has paid us would take
    # the evidence of the payment with it, and that row is what a refund
    # gets argued from. Closing an account is by hand for this reason.
    user = models.ForeignKey("authentication.User", on_delete=models.PROTECT, related_name="purchases")

    plan = models.CharField(max_length=20, db_index=True)
    status = models.CharField(max_length=20, choices=STATUSES, default=PENDING, db_index=True)

    session_id = models.CharField(max_length=255, db_index=True)
    payment_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)

    # Set only for the recurring plans. It is what a renewal is read back
    # against, and its absence is what makes a row a one-time payment.
    subscription_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    # The provider's own word for how the subscription is doing, kept
    # verbatim rather than translated, so a status nobody has seen before
    # reads strangely in the admin instead of quietly becoming "fine".
    subscription_status = models.CharField(max_length=40, null=True, blank=True)
    # Whether the provider has been told to stop at the end of the period.
    # Not something `subscription_status` can say: a cancelled subscription
    # stays active until the time already paid for runs out, which is the
    # promise rather than a bug. Without this the account page would go on
    # announcing a renewal on a date nobody will ever charge.
    cancel_at_next_billing_date = models.BooleanField(default=False)

    # The provider's id for whoever paid, learned from the payment rather
    # than minted here. It is the only thing their customer portal can be
    # opened against, which is the whole reason it is stored. Null on rows
    # written before it was known, and filled in lazily (card 26).
    customer_id = models.CharField(max_length=255, null=True, blank=True)
    # The last time the provider was asked about this subscription, which
    # throttles the asking: an expired row is re-read at most once an hour,
    # not once a page load.
    checked_at = models.DateTimeField(null=True, blank=True)

    # The quote: what was asked for, and the two numbers behind it.
    amount_minor = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    usd_cents = models.PositiveIntegerField()
    fx_rate = models.FloatField(default=1.0)
    ppp_multiplier = models.FloatField(default=1.0)

    # The statement: what was actually taken. Null until settlement.
    charged_minor = models.PositiveIntegerField(null=True, blank=True)
    charged_currency = models.CharField(max_length=3, null=True, blank=True)

    # The affiliate this purchase is credited to, decided when the checkout
    # opens and frozen there like the price, and what the credit came to,
    # written at settlement once the charge is known (card 31). The
    # commission stays on a refunded row: the balance is derived over
    # `status`, so a refund takes it back without rewriting anything here.
    referrer = models.ForeignKey(
        "authentication.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="referred_purchases"
    )
    commission_usd_cents = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    # When the access this row bought stops. Null means never, which is
    # what lifetime buys. Indexed because it is half of the entitlement
    # question asked on every page.
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "purchases"
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"{self.reference} {self.plan} {self.status}"
