"""Opening a checkout, settling what comes back, keeping an expiry honest.

Nothing a browser says is trusted: the return URL carries ids and every
claim attached to them is re-read. Two things bind a payment to a row,
our reference and the checkout session it opened. The price is not one of
them: a disagreement is a log line, never a refusal, because by then the
money has moved.
"""

import datetime as dt
import logging
import uuid

from django.conf import settings

from apps.common import mail
from apps.payments import plans, pricing, services
from apps.payments.dodo import DEAD, SUBSCRIPTION_OVER, SUCCEEDED, DodoError, gateway
from apps.payments.models import Purchase

logger = logging.getLogger(__name__)


class NotForSale(Exception):
    """This plan cannot be bought right now, and the sentence says why."""


def start(user, *, plan_code: str, currency: str, referrer=None) -> tuple[Purchase, str]:
    """Open a checkout and write the pending row. Returns where to send
    them.

    The row is written after the provider answers, not before: a row
    pointing at a checkout that was never created is a pending purchase
    nobody can ever settle or explain.

    The quote is frozen here. Rates move and the multiplier table gets
    edited, and neither may quietly rewrite what a receipt from last
    March says was asked for. So is the referrer: who sent a buyer is a
    fact about the day they bought (card 31).
    """
    plan = plans.plan(plan_code)
    if not plans.on_sale(plan_code):
        raise NotForSale(f"{plan.name} is not for sale right now.")
    # The same refusal the pricing page prints, asked again: a page
    # rendered five minutes ago is not permission.
    if refused := services.refusal(user, plan_code):
        raise NotForSale(f"Nothing to buy: {refused}.")

    price = pricing.quote(currency, plan.usd_cents)
    reference = uuid.uuid4().hex
    checkout = gateway().create_checkout(
        product_id=plans.product_id(plan_code),
        amount_minor=price.amount_minor,
        currency=price.currency,
        country=price.market.country,
        email=user.email,
        return_url=f"{settings.FRONTEND_ORIGIN}/pro/done?ref={reference}",
        reference=reference,
    )
    row = Purchase.objects.create(
        reference=reference,
        user=user,
        plan=plan_code,
        session_id=checkout.session_id,
        amount_minor=price.amount_minor,
        currency=price.currency,
        usd_cents=plan.usd_cents,
        fx_rate=price.rate,
        ppp_multiplier=price.ppp,
        referrer=referrer,
    )
    return row, checkout.url


def by_reference(user, reference: str) -> Purchase | None:
    """One of this account's own purchases. Scoped to the account on
    purpose: a reference is not a secret worth relying on, and the row it
    names is somebody's payment history."""
    return Purchase.objects.filter(reference=reference, user=user).first()


def verify(row: Purchase, *, payment_id: str = "", subscription_id: str = "") -> Purchase:
    """Settle a pending purchase, if it can be settled yet.

    Safe to call any number of times: a settled row short-circuits with
    no round trip, so reloading the return page today or next year
    re-grants nothing and re-charges nothing.
    """
    if row.status != Purchase.PENDING:
        return row
    plan = services.plan_of(row)
    if plan is None:
        # Bought under a plan the catalogue no longer names. Never guess
        # what it entitles somebody to; park it for a person.
        logger.error("purchase %s names an unknown plan %r", row.reference, row.plan)
        return row
    if payment_id:
        return _settle_payment(row, plan, payment_id, subscription_id)
    if subscription_id and plan.recurring:
        return _settle_subscription(row, subscription_id)
    # Back with neither: paid in a tab we never heard about, or never
    # paid at all. Pending is the honest answer to both.
    return row


def _settle_payment(row: Purchase, plan: plans.Plan, payment_id: str, subscription_id: str) -> Purchase:
    payment = gateway().payment(payment_id)

    if payment.reference != row.reference or payment.session_id != row.session_id:
        # Somebody else's payment id, or a stale one from an earlier
        # attempt. Either way it settles nothing here.
        logger.warning(
            "payment %s does not belong to purchase %s (ref %r, session %r)",
            payment_id,
            row.reference,
            payment.reference,
            payment.session_id,
        )
        return row

    row.payment_id = payment.payment_id
    row.subscription_id = payment.subscription_id or subscription_id or None
    _remember_customer(row, payment.customer_id)

    if payment.status == SUCCEEDED:
        _record_charge(row, payment.amounts)
        row.status = Purchase.PAID
        row.verified_at = dt.datetime.now(dt.UTC)
        row.expires_at = _grant_until(row, plan)
    elif payment.status in DEAD:
        row.status = Purchase.FAILED
    row.save()

    if row.status == Purchase.PAID:
        # A recurring plan's expiry is the provider's billing date and
        # not ours to compute. The first charge has just handed us the
        # subscription id, so the first read is now.
        if plan.recurring and row.subscription_id:
            row = refresh(row)
        _receipt(row)
    # The Slack lines for both outcomes land with card 27, after the row
    # is committed and never in front of it.
    return row


def _settle_subscription(row: Purchase, subscription_id: str) -> Purchase:
    """The return trip for a subscription that named no payment.

    The binding is the reference alone, and it is no weaker for it: what
    is compared is the reference the provider stored in the
    subscription's own metadata against this row's. A subscription id
    lifted from somebody else's return URL carries their reference, not
    this row's, so it matches nothing.
    """
    live = gateway().subscription(subscription_id)
    if live.reference != row.reference:
        logger.warning("subscription %s does not belong to purchase %s", subscription_id, row.reference)
        return row
    if not live.active:
        return row

    row.subscription_id = live.subscription_id
    row.subscription_status = live.status
    row.cancel_at_next_billing_date = live.cancel_at_next_billing_date
    _remember_customer(row, live.customer_id)
    # The charge, which the subscription object cannot report: its
    # recurring amount is the product's pre-tax figure in the product's
    # own currency, and neither of those is anybody's bank statement.
    charge = gateway().subscription_payment(subscription_id)
    if charge is not None:
        row.payment_id = charge.payment_id
        _record_charge(row, charge.amounts)
        _remember_customer(row, charge.customer_id)
    row.status = Purchase.PAID
    row.verified_at = dt.datetime.now(dt.UTC)
    row.expires_at = _expiry_from(live)
    row.checked_at = dt.datetime.now(dt.UTC)
    row.save()
    _receipt(row)
    return row


def refresh(row: Purchase) -> Purchase:
    """Re-read one subscription and write down what it said.

    `checked_at` is stamped whatever happens, the provider being
    unreachable included: a bad hour of theirs must not turn into a call
    per page view. The grace window is what covers that outage, and by
    the time this matters the subscription has been past its billing date
    for two days already.
    """
    now = dt.datetime.now(dt.UTC)
    row.checked_at = now
    try:
        live = gateway().subscription(row.subscription_id or "")
    except DodoError:
        logger.warning("could not re-read subscription %s", row.subscription_id, exc_info=True)
        row.save(update_fields=["checked_at"])
        return row

    row.subscription_status = live.status
    row.cancel_at_next_billing_date = live.cancel_at_next_billing_date
    _remember_customer(row, live.customer_id)
    if live.over:
        # Finished, and never to be asked about again. The expiry stays
        # where it is: what was already paid for is not taken back.
        pass
    elif live.next_billing_at:
        row.expires_at = live.next_billing_at + services.GRACE
    elif live.active:
        # Active, and they did not say when it renews. Trust it for the
        # grace window rather than cutting somebody off on a missing date.
        row.expires_at = now + services.GRACE
    row.save()
    return row


def due(user) -> list[Purchase]:
    """The subscriptions worth asking about: run out, not already
    finished, and not asked about within the hour. Three conditions and
    all three matter, or a cancelled plan would be re-read on every page
    load for the rest of time."""
    now = dt.datetime.now(dt.UTC)
    stale = []
    for row in Purchase.objects.filter(user=user, status=Purchase.PAID).exclude(subscription_id=None):
        if row.expires_at is None or row.expires_at > now:
            continue
        if row.subscription_status in SUBSCRIPTION_OVER:
            continue
        if row.checked_at is None or now - row.checked_at > services.RECHECK:
            stale.append(row)
    return stale


def catch_up(user) -> None:
    """Re-read whatever has run out, at most hourly each. The two moments
    the answer can have changed are a stored expiry passing and a trip
    back from the portal, and this is called at both. An ordinary visit
    by a live subscriber costs no calls at all."""
    for row in due(user):
        refresh(row)


def portal_link(user, return_url: str = "") -> str:
    """A link into the provider's portal for this account.

    The customer id is not ours to derive: it exists only on a payment or
    a subscription at their end. It lands with the settlement on new rows
    and is backfilled here on old ones, the first time somebody presses
    the button, by re-reading a subscription they already hold.
    """
    row = _with_customer(user)
    if row is None:
        raise DodoError("this account has no customer to open a portal for")
    return gateway().portal(row.customer_id or "", return_url)


def _with_customer(user) -> Purchase | None:
    rows = list(Purchase.objects.filter(user=user, status=Purchase.PAID))
    for row in rows:
        if row.customer_id:
            return row
    # Nothing carries one yet: a row written before the column existed.
    # One re-read fills it in, and only for a subscription, which is the
    # only thing there is to re-read.
    for row in rows:
        if row.subscription_id:
            refreshed = refresh(row)
            if refreshed.customer_id:
                return refreshed
    return None


def _remember_customer(row: Purchase, customer_id: str) -> None:
    """Written once and never overwritten with nothing: the thinner
    payment shapes do not carry a customer, and a blank one arriving
    later must not erase the id the portal is opened against."""
    if customer_id and not row.customer_id:
        row.customer_id = customer_id


def _record_charge(row: Purchase, amounts: tuple[tuple[int, str], ...]) -> None:
    """What was actually taken, beside what was quoted.

    The provider names one charge in more than one currency (the card's
    and the settlement's), and either can be the one we quoted, so the
    quote is looked for in all of them. Finding it is the ordinary case
    and nothing is said. Not finding it is written down and left alone:
    the money has moved, so this is an operator's problem and never the
    buyer's, and the Slack line for it lands with card 27.
    """
    matched = next((pair for pair in amounts if pair[1] == row.currency), None)
    charged_minor, charged_currency = matched or amounts[0]
    row.charged_minor = charged_minor
    row.charged_currency = charged_currency
    if matched is None or charged_minor != row.amount_minor:
        logger.error(
            "purchase %s quoted %s %s and was charged %s %s",
            row.reference,
            row.amount_minor,
            row.currency,
            charged_minor,
            charged_currency,
        )


def _grant_until(row: Purchase, plan: plans.Plan) -> dt.datetime | None:
    """When a settled one-time purchase stops granting Pro.

    Days stack rather than restart. Somebody who buys a second pass on
    day twenty has forty days left, not thirty: charging for time and
    then taking ten days of it back is the kind of small dishonesty
    nobody mentions and everybody notices.
    """
    if plan.days is None:
        return None
    now = dt.datetime.now(dt.UTC)
    others = Purchase.objects.filter(user_id=row.user_id, status=Purchase.PAID).exclude(pk=row.pk)
    running = []
    for other in others:
        if other.expires_at is None:
            return None  # already forever; there is nothing to count from
        if other.expires_at > now:
            running.append(other.expires_at)
    return max([now, *running]) + dt.timedelta(days=plan.days)


def _expiry_from(live) -> dt.datetime | None:
    if live.next_billing_at:
        return live.next_billing_at + services.GRACE
    return dt.datetime.now(dt.UTC) + services.GRACE


def _receipt(row: Purchase) -> None:
    """Mail the receipt after the row settles, never before, and never in
    the way of the grant: a provider having a day is a log line, not a
    purchase that failed."""
    plan = services.plan_of(row)
    mail.send(
        "receipt",
        to=row.user.email,
        subject=f"Your {settings.SITE_NAME} receipt",
        reference=row.reference,
        plan_name=plan.name if plan else row.plan,
        recurring=plan.recurring if plan else False,
        charged=pricing.display(
            row.charged_minor if row.charged_minor is not None else row.amount_minor,
            row.charged_currency or row.currency,
        ),
        expires_at=row.expires_at,
        link=f"{settings.FRONTEND_ORIGIN}/pro/done?ref={row.reference}",
    )
