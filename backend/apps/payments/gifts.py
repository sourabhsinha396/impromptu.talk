"""Pro given away, and taken back.

A gift is a purchase row like any other, because the entitlement query has
one branch and must not grow a second: `status` is paid, and `expires_at`
is what says forever or a month. What makes it a gift is `plan`, one of
`plans.COMPLIMENTARY`, so it is visible in the table, on the person's own
account page, and to anybody counting revenue, without any of them having
to know that zero means something.

Three fields are deliberately empty rather than filled with something
plausible. `session_id` is "", because there was no checkout to bind an
arriving payment against and a made-up one is a binding that could match.
`verified_at` stays null, because nothing was verified: a stamp there
claims a trip to the provider that never happened. `charged_minor` and
`charged_currency` stay null for the same reason - no card was charged,
and a zero would read as a charge of nothing.

Nothing here is announced. The Slack channel carries the six things
somebody would act on today, and the operator giving a gift is the person
who would have acted.
"""

import datetime as dt
import logging
import uuid

from apps.payments import plans
from apps.payments.models import Purchase

logger = logging.getLogger(__name__)

ALREADY_HELD = "that account already has Pro for life"
NOT_A_GIFT = "That purchase was paid for. Pulling Pro off it is a refund, and a refund starts at the provider."


class NotAGift(Exception):
    """This purchase took money, so it cannot be taken back here."""


def grant(user, plan_code: str) -> Purchase:
    """Give an account Pro without taking any money for it."""
    plan = plans.plan(plan_code)
    if plan_code not in plans.COMPLIMENTARY:
        raise plans.UnknownPlan(plan_code)
    now = dt.datetime.now(dt.UTC)
    return Purchase.objects.create(
        reference=uuid.uuid4().hex,
        user=user,
        plan=plan_code,
        status=Purchase.PAID,
        session_id="",
        amount_minor=0,
        currency="USD",
        usd_cents=0,
        expires_at=None if plan.days is None else now + dt.timedelta(days=plan.days),
    )


def revoke(row: Purchase) -> Purchase:
    """Stop a gift, now.

    `expires_at` moves to this moment and `status` stays paid, so the row
    reads as one that ran out, which is exactly what happened. It is not
    refunded: nothing went back to anybody, and that word is reserved for
    the admin edit that follows money actually moving. Borrowing it here
    would put a refund in the channel that never occurred.

    The row survives, like every other purchase: a gift taken back is the
    thing a support mail is about, and a deleted one explains nothing.
    """
    if row.plan not in plans.COMPLIMENTARY:
        raise NotAGift(row.reference)
    row.expires_at = dt.datetime.now(dt.UTC)
    row.save(update_fields=["expires_at"])
    logger.info("revoked %s from user %s", row.plan, row.user_id)
    return row


def live(*, now: dt.datetime | None = None) -> list[Purchase]:
    """Every gift still granting Pro, newest first.

    Live ones only. The list answers "who has Pro they did not pay for",
    and a revoked row is no longer part of that answer; it stays in the
    table for anybody reading the history.
    """
    moment = now or dt.datetime.now(dt.UTC)
    rows = Purchase.objects.filter(plan__in=plans.COMPLIMENTARY, status=Purchase.PAID).select_related("user")
    return [row for row in rows if row.expires_at is None or row.expires_at > moment]
