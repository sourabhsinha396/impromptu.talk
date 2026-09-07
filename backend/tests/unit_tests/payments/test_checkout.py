"""Checkout, settlement, subscriptions and the portal, against a
recorded gateway. No test in this suite reaches the provider."""

import datetime as dt

import pytest
from django.core import mail
from django.test import Client, override_settings

from apps.payments import checkout, dodo, services
from apps.payments.models import Purchase
from tests.unit_tests import factories

CHECKOUT = "/api/v1/payments/checkout"
SETTLE = "/api/v1/payments/settle"
PORTAL = "/api/v1/payments/portal"
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


def open_checkout(buyer, plan="lifetime", currency="USD") -> Purchase:
    response = buyer.post(CHECKOUT, {"plan": plan, "currency": currency}, content_type=JSON)
    assert response.status_code == 200
    return Purchase.objects.latest("id")


def test_a_checkout_writes_a_pending_row_with_the_quote_frozen_on_it(buyer, gateway, user):
    row = open_checkout(buyer, "lifetime", "INR")
    assert row.status == Purchase.PENDING
    assert (row.amount_minor, row.currency, row.usd_cents) == (115000, "INR", 3900)
    assert (row.fx_rate, row.ppp_multiplier) == (88.0, 0.33)
    sent = gateway.checkouts[0]
    assert sent["product_id"] == "prod_l"
    assert sent["return_url"].endswith(f"/pro/done?ref={row.reference}")
    # The market's country prefills the billing address and stays editable.
    assert sent["country"] == "IN"


def test_a_stranger_cannot_open_a_checkout(client, gateway, db):
    assert client.post(CHECKOUT, {"plan": "lifetime"}, content_type=JSON).status_code == 401


def test_a_plan_that_is_not_on_sale_is_refused_before_the_provider_is_called(buyer, gateway):
    with override_settings(DODO_PRODUCTS={"lifetime": ""}):
        response = buyer.post(CHECKOUT, {"plan": "lifetime"}, content_type=JSON)
    assert response.status_code == 400
    assert gateway.checkouts == []
    assert Purchase.objects.count() == 0


def test_what_the_pricing_page_refuses_the_checkout_refuses_again(buyer, gateway, user):
    factories.PurchaseFactory(user=user, plan="lifetime")
    response = buyer.post(CHECKOUT, {"plan": "monthly"}, content_type=JSON)
    # A page rendered five minutes ago is not permission.
    assert response.status_code == 400
    assert services.HAS_FOREVER in response.json()["detail"]


def test_a_provider_that_cannot_be_reached_writes_no_row(buyer, gateway):
    gateway.error = dodo.DodoError("down")
    assert buyer.post(CHECKOUT, {"plan": "lifetime"}, content_type=JSON).status_code == 502
    assert Purchase.objects.count() == 0


def test_a_succeeded_payment_grants_pro_and_records_what_the_card_was_charged(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    body = buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON).json()

    row.refresh_from_db()
    assert row.status == Purchase.PAID
    assert row.expires_at is None
    assert (row.charged_minor, row.charged_currency) == (3900, "USD")
    assert row.customer_id == "cus_1"
    assert services.is_pro(user) is True
    assert body["status"] == "paid"
    assert body["charged"] == "$39"


def test_settling_twice_grants_nothing_twice(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    for _ in range(3):
        buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    assert Purchase.objects.filter(status=Purchase.PAID).count() == 1
    # One receipt, not three.
    assert len(mail.outbox) == 1


def test_somebody_elses_payment_id_settles_nothing(buyer, gateway, user):
    row = open_checkout(buyer)
    # Right shape, wrong reference and session: a payment lifted from
    # another return URL.
    gateway.paid(payment(row, payment_id="pay_theirs", reference="someone-else", session_id="cks_theirs"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_theirs"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.PENDING
    assert services.is_pro(user) is False


def test_a_payment_carrying_our_reference_but_another_session_settles_nothing(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row, session_id="cks_somebody_else"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.PENDING


def test_a_dead_payment_is_written_down_as_failed_and_grants_nothing(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row, status="failed"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.FAILED
    assert services.is_pro(user) is False


def test_a_price_that_disagrees_still_grants_pro(buyer, gateway, user, caplog):
    row = open_checkout(buyer)
    # A product edited in their dashboard. The money has already moved, so
    # refusing would take it and hand back a page saying they did not pay.
    gateway.paid(payment(row, amount_minor=100))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.PAID
    assert (row.amount_minor, row.charged_minor) == (3900, 100)
    assert "quoted" in caplog.text


def test_a_buyer_who_switched_currency_has_the_settlement_side_matched(buyer, gateway, user):
    row = open_checkout(buyer, "lifetime", "USD")
    # Charged in rupees, settled in the dollars we quoted.
    gateway.paid(payment(row, amount_minor=345000, currency="INR", settlement_minor=3900, settlement_currency="USD"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    assert (row.charged_minor, row.charged_currency) == (3900, "USD")


def test_a_pass_stacks_its_days_on_the_time_already_paid_for(buyer, gateway, user):
    first = open_checkout(buyer, "pass")
    gateway.paid(payment(first))
    buyer.post(SETTLE, {"reference": first.reference, "payment_id": "pay_1"}, content_type=JSON)
    first.refresh_from_db()

    second = open_checkout(buyer, "pass")
    gateway.paid(payment(second, payment_id="pay_2"))
    buyer.post(SETTLE, {"reference": second.reference, "payment_id": "pay_2"}, content_type=JSON)
    second.refresh_from_db()
    # Sixty days from now, not thirty: charging for time and then taking
    # ten days of it back is the small dishonesty everybody notices.
    assert (second.expires_at - first.expires_at).days == 30


def test_the_receipt_goes_out_after_the_row_settles(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert row.reference in message.body
    assert "$39" in message.body


def test_a_reference_belonging_to_somebody_else_is_a_page_that_never_existed(buyer, gateway, user):
    other = factories.UserFactory(email="other@example.com")
    theirs = factories.PurchaseFactory(user=other, status=Purchase.PENDING)
    assert buyer.post(SETTLE, {"reference": theirs.reference}, content_type=JSON).status_code == 404


def test_coming_back_with_no_ids_leaves_the_row_pending(buyer, gateway, user):
    row = open_checkout(buyer)
    body = buyer.post(SETTLE, {"reference": row.reference}, content_type=JSON).json()
    assert body["status"] == "pending"


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


def test_a_subscription_takes_its_expiry_from_the_billing_date_and_a_grace_window(buyer, gateway, user):
    row = open_checkout(buyer, "monthly")
    live = gateway.renewing(subscription(row))
    gateway.paid(payment(row, subscription_id="sub_1"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)

    row.refresh_from_db()
    assert row.subscription_id == "sub_1"
    assert row.expires_at == live.next_billing_at + services.GRACE
    assert services.is_pro(user) is True


def test_a_subscription_that_named_no_payment_settles_on_its_own_reference(buyer, gateway, user):
    row = open_checkout(buyer, "monthly")
    gateway.renewing(subscription(row))
    gateway.paid(payment(row, subscription_id="sub_1"))
    buyer.post(SETTLE, {"reference": row.reference, "subscription_id": "sub_1"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.PAID
    # The charge cannot come off the subscription: its recurring amount is
    # the product's pre-tax figure, not anybody's bank statement.
    assert row.charged_minor == 500


def test_a_subscription_naming_somebody_elses_reference_settles_nothing(buyer, gateway, user):
    row = open_checkout(buyer, "monthly")
    gateway.renewing(subscription(row, reference="someone-else"))
    buyer.post(SETTLE, {"reference": row.reference, "subscription_id": "sub_1"}, content_type=JSON)
    row.refresh_from_db()
    assert row.status == Purchase.PENDING


def test_a_live_subscription_is_never_re_read_and_a_lapsed_one_at_most_hourly(buyer, gateway, user):
    row = open_checkout(buyer, "monthly")
    gateway.renewing(subscription(row))
    gateway.paid(payment(row, subscription_id="sub_1"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    reads = len(gateway.reads)

    # Live: an ordinary visit costs nothing.
    checkout.catch_up(user)
    assert len(gateway.reads) == reads

    row.refresh_from_db()
    Purchase.objects.filter(pk=row.pk).update(
        expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(minutes=1),
        checked_at=dt.datetime.now(dt.UTC) - dt.timedelta(hours=2),
    )
    checkout.catch_up(user)
    assert len(gateway.reads) == reads + 1
    # And not again within the hour, however many pages they open.
    checkout.catch_up(user)
    checkout.catch_up(user)
    assert len(gateway.reads) == reads + 1


def test_a_finished_subscription_is_never_asked_about_again(buyer, gateway, user):
    row = factories.PurchaseFactory(
        user=user,
        plan="monthly",
        subscription_id="sub_dead",
        subscription_status="cancelled",
        expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(days=5),
    )
    checkout.catch_up(user)
    assert gateway.reads == []
    assert row.status == Purchase.PAID


def test_cancelling_keeps_the_period_already_paid_for(buyer, gateway, user):
    row = open_checkout(buyer, "monthly")
    live = gateway.renewing(subscription(row))
    gateway.paid(payment(row, subscription_id="sub_1"))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    ends = row.expires_at

    gateway.renewing(subscription(row, next_billing_at=live.next_billing_at, cancel_at_next_billing_date=True))
    Purchase.objects.filter(pk=row.pk).update(expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(minutes=1))
    row.refresh_from_db()
    checkout.refresh(row)

    row.refresh_from_db()
    # Still active, still Pro, and the flag is its own column because the
    # status cannot say it.
    assert row.cancel_at_next_billing_date is True
    assert row.subscription_status == dodo.SUBSCRIPTION_ACTIVE
    assert row.expires_at == ends
    assert services.is_pro(user) is True


def test_a_provider_outage_stamps_the_check_and_does_not_retry_every_page(buyer, gateway, user):
    row = factories.PurchaseFactory(
        user=user,
        plan="monthly",
        subscription_id="sub_1",
        expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(minutes=1),
    )
    gateway.error = dodo.DodoError("down")
    checkout.catch_up(user)
    row.refresh_from_db()
    assert row.checked_at is not None
    checkout.catch_up(user)
    # One ask, not one per page view: the grace window is what covers an
    # outage, and by now the row is two days past its billing date anyway.
    assert len(gateway.reads) == 1


def test_the_portal_opens_against_the_customer_the_settlement_learned(buyer, gateway, user):
    row = open_checkout(buyer)
    gateway.paid(payment(row))
    buyer.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    body = buyer.post(PORTAL, content_type=JSON).json()
    assert body["url"] == gateway.portal_url
    assert gateway.portals == ["cus_1"]


def test_the_customer_id_is_backfilled_on_a_row_written_before_it_was_known(buyer, gateway, user):
    row = factories.PurchaseFactory(user=user, plan="monthly", subscription_id="sub_1", customer_id=None)
    gateway.renewing(subscription(row, customer_id="cus_old"))
    assert buyer.post(PORTAL, content_type=JSON).status_code == 200
    assert gateway.portals == ["cus_old"]


def test_an_account_that_never_paid_has_no_portal_to_open(buyer, gateway, user):
    assert buyer.post(PORTAL, content_type=JSON).status_code == 502


def test_every_call_names_itself(monkeypatch):
    """Their edge is Cloudflare, and it answers 1010 to `Python-urllib`
    before the request reaches them. The header is the whole fix."""
    seen = {}

    class Answer:
        status = 200

        def read(self):
            return b"{}"

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def capture(request, timeout=None):
        seen["headers"] = dict(request.header_items())
        return Answer()

    monkeypatch.setattr("urllib.request.urlopen", capture)
    dodo.DodoGateway("key", "https://test.invalid").payment("pay_1")
    agent = seen["headers"].get("User-agent", "")
    assert agent == dodo.USER_AGENT
    assert "urllib" not in agent
