"""The affiliate programme: the code, the attribution, the money.

The three things that would be expensive to get wrong are pinned hardest:
commission is off the charge and never off the list price, the balance is
derived rather than stored, and nobody on the referrals page is named.
"""

import datetime as dt

import pytest
from django.test import Client, override_settings

from apps.affiliates import services
from apps.affiliates.models import Payout
from apps.common.referrals import REFERRAL_COOKIE
from apps.payments import checkout, dodo
from apps.payments.models import Purchase
from tests.unit_tests import factories

PROGRAMME = "/api/v1/affiliates"
REFERRALS = "/api/v1/affiliates/referrals"
PAYPAL = "/api/v1/affiliates/paypal"
CHECKOUT = "/api/v1/payments/checkout"
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
def priya(db):
    """The affiliate. Her code is minted on her first look at the page."""
    return factories.UserFactory(email="priya@example.com", name="Priya Rao")


def signed_in(user, ref: str = "") -> Client:
    client = Client()
    if ref:
        client.cookies[REFERRAL_COOKIE] = ref
    client.force_login(user)
    return client


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


def buy(client, gateway, plan="lifetime", currency="USD", **over) -> Purchase:
    assert client.post(CHECKOUT, {"plan": plan, "currency": currency}, content_type=JSON).status_code == 200
    row = Purchase.objects.latest("id")
    gateway.paid(payment(row, **over))
    client.post(SETTLE, {"reference": row.reference, "payment_id": "pay_1"}, content_type=JSON)
    row.refresh_from_db()
    return row


class TestTheCode:
    def test_it_is_minted_from_the_first_name_on_the_first_look(self, priya):
        assert signed_in(priya).get(PROGRAMME).json()["code"] == "priya"
        priya.refresh_from_db()
        assert priya.affiliate_code == "priya"

    def test_looking_again_hands_back_the_same_one(self, priya):
        first = signed_in(priya).get(PROGRAMME).json()["code"]
        assert signed_in(priya).get(PROGRAMME).json()["code"] == first

    def test_a_taken_stem_gets_digits_rather_than_somebody_elses_code(self, priya, db):
        services.code_for(priya)
        second = factories.UserFactory(email="priya2@example.com", name="Priya Sharma")
        code = services.code_for(second)
        assert code != "priya"
        assert code.startswith("priya")

    def test_an_account_with_no_name_falls_back_to_the_address(self, db):
        user = factories.UserFactory(email="sam.oh+news@example.com", name="")
        assert services.code_for(user) == "samohnews"

    def test_a_stranger_reads_the_pitch_and_is_handed_no_code(self, client, db):
        body = client.get(PROGRAMME).json()
        assert body["code"] is None and body["link"] is None
        # The numbers a stranger came to read are all there.
        assert body["percent"] == 30
        assert body["cookie_days"] == 60
        assert body["minimum_payout"] == "$10.00"

    def test_the_link_is_the_site_with_one_word_after_it(self, priya, settings):
        settings.FRONTEND_ORIGIN = "https://impromptu.talk"
        assert signed_in(priya).get(PROGRAMME).json()["link"] == "https://impromptu.talk?ref=priya"


class TestWhoGetsCredited:
    def test_the_accounts_own_referrer_wins_over_a_later_click(self, priya, db):
        services.code_for(priya)
        rival = factories.UserFactory(email="rival@example.com", name="Rival")
        services.code_for(rival)
        buyer = factories.UserFactory(email="buyer@example.com", referred_by=priya)

        assert services.referrer_for(buyer, rival.affiliate_code) == priya

    def test_the_cookie_is_the_fallback_for_an_older_account(self, priya, db):
        """Somebody who had an account before they clicked anything."""
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com")
        assert services.referrer_for(buyer, priya.affiliate_code) == priya

    def test_nobody_is_ever_credited_with_themselves(self, priya):
        services.code_for(priya)
        assert services.referrer_for(priya, priya.affiliate_code) is None

    def test_a_code_nobody_holds_credits_nobody(self, db):
        buyer = factories.UserFactory(email="buyer@example.com")
        assert services.referrer_for(buyer, "nosuchcode") is None
        assert services.referrer_for(buyer, "not a code at all") is None

    def test_a_checkout_freezes_the_referrer_on_the_row(self, priya, gateway, db):
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com")
        row = buy(signed_in(buyer, ref="priya"), gateway)
        assert row.referrer == priya


class TestWhatItEarns:
    def test_commission_is_thirty_percent_of_the_charge_not_the_list_price(self, priya, gateway, db):
        """A lifetime bought in rupees is thirteen dollars, and thirty
        percent of thirty-nine would be nearly the whole sale."""
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com")
        row = buy(signed_in(buyer, ref="priya"), gateway, currency="INR")

        assert (row.amount_minor, row.currency) == (115000, "INR")
        # 115000 paise over the frozen rate of 88 is $13.07, and 30% of
        # that is $3.92.
        assert row.commission_usd_cents == 392

    def test_a_dollar_sale_earns_the_plain_thirty_percent(self, priya, gateway, db):
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com")
        row = buy(signed_in(buyer, ref="priya"), gateway)
        assert row.commission_usd_cents == 1170

    def test_a_sale_nobody_referred_earns_nothing_and_says_so_with_a_null(self, gateway, db):
        buyer = factories.UserFactory(email="buyer@example.com")
        row = buy(signed_in(buyer), gateway)
        assert row.referrer is None
        assert row.commission_usd_cents is None

    def test_a_refund_takes_the_commission_back_without_rewriting_the_row(self, priya, gateway, db):
        """The balance is derived over `status`, so a refund is one flip
        and nothing has to hear about it."""
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com")
        row = buy(signed_in(buyer, ref="priya"), gateway)
        assert services.summary(priya).earned_cents == 1170

        row.status = Purchase.REFUNDED
        row.save(update_fields=["status"])
        assert services.summary(priya).earned_cents == 0
        # The number stays on the row: what it earned on the day is a fact.
        assert row.commission_usd_cents == 1170


class TestTheBalanceAndThePage:
    def test_the_page_counts_referrals_purchases_earned_and_paid(self, priya, gateway, db):
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com", referred_by=priya)
        factories.UserFactory(email="lurker@example.com", referred_by=priya)
        buy(signed_in(buyer), gateway)
        services.record_payout(priya, 500, reference="paypal-1")

        body = signed_in(priya).get(REFERRALS).json()
        assert body["summary"] == {
            "referrals": 2,
            "purchases": 1,
            "earned": "$11.70",
            "paid": "$5.00",
            "balance": "$6.70",
            "payable": False,
        }

    def test_nobody_on_the_activity_list_is_named(self, priya, gateway, db):
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com", name="Ada", referred_by=priya)
        buy(signed_in(buyer), gateway)

        body = signed_in(priya).get(REFERRALS).json()
        assert [event["label"] for event in body["activity"]] == ["Lifetime bought", "New account"]
        assert "buyer@example.com" not in str(body)
        assert "Ada" not in str(body)

    def test_a_paypal_address_is_saved_and_can_be_cleared(self, priya):
        client = signed_in(priya)
        assert client.post(PAYPAL, {"email": "priya@paypal.com"}, content_type=JSON).json()["paypal_email"] == (
            "priya@paypal.com"
        )
        assert client.post(PAYPAL, {"email": ""}, content_type=JSON).json()["paypal_email"] == ""

    def test_a_stranger_gets_no_referrals_page(self, client, db):
        assert client.get(REFERRALS).status_code == 401
        assert client.post(PAYPAL, {"email": "x@y.com"}, content_type=JSON).status_code == 401


class TestPayouts:
    def test_a_payout_lowers_the_balance_and_more_than_is_owed_is_refused(self, priya, gateway, db):
        services.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com", referred_by=priya)
        buy(signed_in(buyer), gateway)

        services.record_payout(priya, 1000)
        assert services.summary(priya).balance_cents == 170
        with pytest.raises(services.NotOwed):
            services.record_payout(priya, 500)
        with pytest.raises(services.NotOwed):
            services.record_payout(priya, 0)
        assert Payout.objects.count() == 1

    def test_the_owed_list_names_who_has_earned_and_who_has_nowhere_to_be_paid(self, priya, gateway, db):
        """The list is also how an operator sees somebody sitting on a
        balance with no address, which is a support mail waiting."""
        services.code_for(priya)
        quiet = factories.UserFactory(email="quiet@example.com", name="Quiet")
        services.code_for(quiet)
        buyer = factories.UserFactory(email="buyer@example.com", referred_by=priya)
        buy(signed_in(buyer), gateway)

        rows = services.owed()
        assert [row.user for row in rows] == [priya]
        assert rows[0].summary.balance_cents == 1170
        assert rows[0].ready is False  # over the minimum, but no address yet

        services.set_paypal(priya, "priya@paypal.com")
        assert services.owed()[0].ready is True


class TestTheAccountPage:
    def test_the_account_payload_carries_the_link_minted_on_the_first_look(self, priya):
        body = signed_in(priya).get("/api/v1/auth/account").json()
        assert body["affiliate_code"] == "priya"


def test_a_month_old_signup_still_shows_on_the_activity_list(priya, db):
    """The list is the affiliate's own record and is not trimmed by age;
    only the count is capped."""
    old = factories.UserFactory(email="old@example.com", referred_by=priya)
    old.created_at = dt.datetime.now(dt.UTC) - dt.timedelta(days=40)
    old.save(update_fields=["created_at"])
    assert [event.label for event in services.activity(priya)] == ["New account"]
