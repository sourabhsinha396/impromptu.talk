"""The five money events that reach the channel, and the two that do not.

Everything runs against the recorded gateway and the recorded channel, so
no test here reaches the provider or Slack. What is pinned is which
moments earn a line: somebody who paid, somebody who tried to and could
not, a refund, a subscription that stopped renewing, and a product priced
wrong at the provider's end. A settled row read back a second time is not
one of them.
"""

import datetime as dt

import pytest
from django.test import Client, override_settings

from apps.payments import checkout, dodo
from apps.payments.models import Purchase

SETTLE = "/api/v1/payments/settle"
JSON = "application/json"

OPEN = override_settings(
    DODO_API_KEY="live",
    DODO_PRODUCTS={"monthly": "prod_m", "annual": "prod_a", "pass": "prod_p", "lifetime": "prod_l"},
)


@pytest.fixture
def gateway():
    recorded = dodo.RecordingGateway()
    dodo.use_gateway(recorded)
    with OPEN:
        yield recorded
    dodo.use_gateway(None)


@pytest.fixture
def buyer(user):
    signed_in = Client()
    signed_in.force_login(user)
    return signed_in


def payment(row: Purchase, **over) -> dodo.Payment:
    fields = {
        "payment_id": "pay_1",
        "status": dodo.SUCCEEDED,
        "amount_minor": row.amount_minor,
        "currency": row.currency,
        "session_id": row.session_id,
        "reference": row.reference,
        "customer_id": "cus_1",
    }
    return dodo.Payment(**{**fields, **over})


def subscription(row: Purchase, **over) -> dodo.Subscription:
    fields = {
        "subscription_id": "sub_1",
        "status": dodo.SUBSCRIPTION_ACTIVE,
        "next_billing_at": dt.datetime.now(dt.UTC) + dt.timedelta(days=30),
        "amount_minor": row.amount_minor,
        "currency": row.currency,
        "reference": row.reference,
        "customer_id": "cus_1",
    }
    return dodo.Subscription(**{**fields, **over})


def open_checkout(buyer, plan="lifetime", currency="USD") -> Purchase:
    assert buyer.post("/api/v1/payments/checkout", {"plan": plan, "currency": currency}, content_type=JSON).status_code
    return Purchase.objects.latest("id")


def settle(buyer, row, **body):
    return buyer.post(SETTLE, {"reference": row.reference, **body}, content_type=JSON)


def test_a_settled_payment_is_announced_with_the_row_and_what_was_charged(buyer, gateway, channel, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    settle(buyer, row, payment_id="pay_1")

    assert channel.headlines == ["Payment received"]
    posted = channel.posted[0]
    assert row.reference in posted
    assert user.email in posted
    assert "Lifetime" in posted
    assert "$39" in posted


def test_a_dead_payment_is_announced_too(buyer, gateway, channel):
    """Somebody who tried to hand us money and could not, which is the
    test for what earns a line. A finished round is not."""
    row = open_checkout(buyer)
    gateway.paid(payment(row, status="failed"))
    settle(buyer, row, payment_id="pay_1")

    row.refresh_from_db()
    assert row.status == Purchase.FAILED
    assert channel.headlines == ["Payment failed"]
    assert "reason: failed" in channel.posted[0]


def test_settling_twice_announces_once(buyer, gateway, channel):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    for _ in range(3):
        settle(buyer, row, payment_id="pay_1")
    assert channel.headlines == ["Payment received"]


def test_a_payment_that_is_not_ours_announces_nothing(buyer, gateway, channel):
    """It settles nothing, so there is nothing to say. A line here would
    be a notification anybody with a return URL could fire."""
    row = open_checkout(buyer)
    gateway.paid(payment(row, payment_id="pay_theirs", reference="someone-else", session_id="cks_theirs"))
    settle(buyer, row, payment_id="pay_theirs")
    assert channel.posted == []


def test_a_price_that_drifted_is_announced_ahead_of_the_payment_and_refuses_nothing(buyer, gateway, channel, user):
    """`docs/PRICING.md` §3 is emphatic that a mismatch must not refuse
    the purchase, which left it a log line with an audience of nobody.
    Both halves together: the grant still happens, and somebody now hears
    that the dashboard is wrong for the next buyer."""
    row = open_checkout(buyer)
    gateway.paid(payment(row, amount_minor=row.amount_minor + 100))
    settle(buyer, row, payment_id="pay_1")

    row.refresh_from_db()
    assert row.status == Purchase.PAID
    assert channel.headlines == ["Price mismatch - a product has drifted", "Payment received"]
    assert f"quoted: {row.amount_minor} USD" in channel.posted[0]
    assert f"charged: {row.amount_minor + 100} USD" in channel.posted[0]


def test_a_currency_switch_is_not_a_mismatch(buyer, gateway, channel):
    """Ordinary: the provider's dialog lets a buyer switch, and switching
    moves them to that currency's band, so neither figure it names is the
    one we quoted and there is nothing to compare. A channel that reports
    this is one that gets muted before the real mismatch arrives."""
    row = open_checkout(buyer, "lifetime", "USD")
    gateway.paid(payment(row, amount_minor=115000, currency="INR", settlement_minor=3400, settlement_currency="EUR"))
    settle(buyer, row, payment_id="pay_1")

    row.refresh_from_db()
    assert (row.charged_minor, row.charged_currency) == (115000, "INR")
    assert channel.headlines == ["Payment received"]


def test_the_settlement_side_can_be_the_currency_we_quoted(buyer, gateway, channel):
    """One charge, named twice: the card's currency and the settlement's,
    and either can be ours, which is why both are looked at."""
    row = open_checkout(buyer, "lifetime", "USD")
    gateway.paid(payment(row, amount_minor=115000, currency="INR", settlement_minor=4200, settlement_currency="USD"))
    settle(buyer, row, payment_id="pay_1")

    assert channel.headlines == ["Price mismatch - a product has drifted", "Payment received"]
    assert "charged: 4200 USD" in channel.posted[0]


def _subscribed(buyer, gateway) -> Purchase:
    row = open_checkout(buyer, "monthly")
    gateway.renewing(subscription(row))
    gateway.paid(payment(row, subscription_id="sub_1"))
    settle(buyer, row, payment_id="pay_1")
    row.refresh_from_db()
    return row


def _lapse(row: Purchase) -> Purchase:
    Purchase.objects.filter(pk=row.pk).update(expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(minutes=1))
    row.refresh_from_db()
    return row


def test_a_cancellation_is_announced_once_and_not_on_every_read(buyer, gateway, channel):
    """Nothing else could surface this: subscriptions are read, never
    webhooked, so a cancellation exists here only because somebody came
    back through the portal. The event is the flip, not the state, or
    every trip home would announce the same one again."""
    row = _subscribed(buyer, gateway)
    gateway.renewing(subscription(row, cancel_at_next_billing_date=True))
    for _ in range(3):
        checkout.refresh(_lapse(row))

    assert channel.headlines == ["Payment received", "Subscription cancelled"]
    assert row.reference in channel.posted[1]


def test_a_status_that_moves_to_over_counts_as_a_cancellation_too(buyer, gateway, channel):
    """The provider says this two ways and means the same thing both."""
    row = _subscribed(buyer, gateway)
    gateway.renewing(subscription(row, status="cancelled", next_billing_at=None))
    checkout.refresh(_lapse(row))
    assert channel.headlines[-1] == "Subscription cancelled"


def test_a_live_subscription_and_a_provider_outage_both_say_nothing(buyer, gateway, channel):
    """A renewal that is working is normal operation, and a provider
    having a bad minute is not churn."""
    row = _subscribed(buyer, gateway)
    checkout.refresh(_lapse(row))
    gateway.error = dodo.DodoError("down")
    checkout.refresh(_lapse(row))
    assert channel.headlines == ["Payment received"]


def test_a_refund_is_announced(buyer, gateway, channel, user):
    """The one event with no code path of its own behind it: the money
    goes back in the provider's dashboard and the row is marked by hand,
    so the admin calls this (card 28)."""
    row = _subscribed(buyer, gateway)
    checkout.announce_refund(row)

    assert channel.headlines[-1] == "Refunded"
    posted = channel.posted[-1]
    assert row.reference in posted
    assert user.email in posted
