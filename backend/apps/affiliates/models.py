"""What lowers a balance, and nothing else.

There is no affiliates table. An affiliate is an account with a code, and
the code and the PayPal address are two columns on `User`; who referred
whom is `User.referred_by`, and what a sale earned is
`Purchase.commission_usd_cents`. A payout is the one fact none of those
rows can carry, because it happened at PayPal and only a person can say
so.

The balance itself is never stored. It is commission over paid purchases
less payouts, counted every time it is asked, for the reason the streak
gives about a stored count: a balance column drifts the first time a
refund lands after a payout, and then the number on the page and the
number in the table disagree with nobody able to say since when.
"""

from django.conf import settings
from django.db import models


class Payout(models.Model):
    """One transfer, written down after the money moved.

    PayPal is a dashboard somebody logs into, so this is a record and
    never an instruction: nothing in this codebase can send money. The
    reference is whatever the dashboard called the transfer, so a row
    here can be matched to one there when somebody asks.
    """

    # PROTECT, like a purchase: deleting an account that has been paid
    # would take the evidence of the payment with it.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payouts"
    )
    amount_usd_cents = models.PositiveIntegerField()
    reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "payouts"
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"${self.amount_usd_cents / 100:,.2f} to {self.user_id}"
