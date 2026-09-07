"""The operator's console: the gate, the gifts, the payouts, the pitch.

Ported from v0's `test_administration.py`. The gate is pinned hardest,
because it is the one thing here that is somebody else's problem when it
is wrong: every route answers 404 to anybody who may not use it, so a
signed-out stranger, a signed-in speaker and a mistyped path are told the
same thing.
"""

import datetime as dt

import pytest
from django.test import Client

from apps.administration import services
from apps.administration.models import Outreach
from apps.affiliates import services as affiliates
from apps.affiliates.models import Payout
from apps.payments import gifts, plans
from apps.payments import services as payments
from apps.payments.models import Purchase
from tests.unit_tests import factories

PRO = "/api/v1/administration/pro"
REVOKE = "/api/v1/administration/pro/revoke"
PAYOUTS = "/api/v1/administration/payouts"
OUTREACH = "/api/v1/administration/outreach"
JSON = "application/json"


@pytest.fixture
def operator(db):
    boss = factories.UserFactory(email="owner@example.com", is_staff=True, is_superuser=True)
    client = Client()
    client.force_login(boss)
    return client


@pytest.fixture
def speaker(db):
    client = Client()
    client.force_login(factories.UserFactory(email="speaker@example.com"))
    return client


class TestTheGate:
    @pytest.mark.parametrize(
        "method,path",
        [
            ("get", PRO),
            ("post", PRO),
            ("post", REVOKE),
            ("get", PAYOUTS),
            ("post", PAYOUTS),
            ("get", OUTREACH),
            ("post", OUTREACH),
        ],
    )
    def test_an_ordinary_account_gets_a_404_from_every_route(self, speaker, method, path):
        """Never a 403 and never a redirect: either confirms the path was
        guessed right."""
        call = getattr(speaker, method)
        response = call(path, {}, content_type=JSON) if method == "post" else call(path)
        assert response.status_code == 404

    def test_a_stranger_gets_the_same_404(self, client, db):
        """Not a 401 either: a signed-out prober learns nothing about
        whether the path is real."""
        assert client.get(PRO).status_code == 404
        assert client.post(PRO, {}, content_type=JSON).status_code == 404

    def test_the_owner_gets_in(self, operator):
        assert operator.get(PRO).status_code == 200


class TestGivingPro:
    def test_a_gift_grants_pro_without_pretending_a_payment_happened(self, operator, db):
        holder = factories.UserFactory(email="creator@example.com")
        body = operator.post(PRO, {"email": "Creator@Example.com", "plan": plans.COMP}, content_type=JSON).json()

        row = Purchase.objects.get(user=holder)
        assert (row.status, row.plan) == (Purchase.PAID, plans.COMP)
        assert row.expires_at is None
        # The three fields that are empty on purpose rather than filled
        # with something plausible.
        assert row.session_id == ""
        assert row.verified_at is None
        assert (row.charged_minor, row.charged_currency) == (None, None)
        assert payments.held(holder) == row
        assert [gift["email"] for gift in body["gifts"]] == ["creator@example.com"]

    def test_a_month_long_gift_runs_out_on_a_date(self, operator, db):
        holder = factories.UserFactory(email="creator@example.com")
        operator.post(PRO, {"email": holder.email, "plan": plans.COMP_PASS}, content_type=JSON)
        row = Purchase.objects.get(user=holder)
        assert row.expires_at is not None
        assert 29 <= (row.expires_at - dt.datetime.now(dt.UTC)).days <= 30

    def test_an_address_with_no_account_is_refused_rather_than_signed_up(self, operator, db):
        response = operator.post(PRO, {"email": "nobody@example.com", "plan": plans.COMP}, content_type=JSON)
        assert response.status_code == 404
        assert "sign up" in response.json()["detail"]
        assert Purchase.objects.count() == 0

    def test_a_plan_that_is_not_one_of_the_two_lengths_is_refused(self, operator, db):
        holder = factories.UserFactory(email="creator@example.com")
        response = operator.post(PRO, {"email": holder.email, "plan": "lifetime"}, content_type=JSON)
        assert response.status_code == 400
        assert Purchase.objects.count() == 0

    def test_taking_a_gift_back_expires_it_and_leaves_the_row(self, operator, db):
        holder = factories.UserFactory(email="creator@example.com")
        operator.post(PRO, {"email": holder.email, "plan": plans.COMP}, content_type=JSON)
        row = Purchase.objects.get(user=holder)

        body = operator.post(REVOKE, {"purchase_id": row.pk}, content_type=JSON).json()
        row.refresh_from_db()
        # Not refunded: nothing went back to anybody, and that word would
        # put a refund in the channel that never occurred.
        assert row.status == Purchase.PAID
        assert row.expires_at is not None and row.expires_at <= dt.datetime.now(dt.UTC)
        assert payments.held(holder) is None
        assert body["gifts"] == []

    def test_a_purchase_that_took_money_can_never_be_taken_back_here(self, operator, user):
        """Pulling Pro off a paid row is a refund, and a refund starts at
        the provider and finishes in the admin."""
        paid = factories.PurchaseFactory(user=user, plan="lifetime", status=Purchase.PAID)
        response = operator.post(REVOKE, {"purchase_id": paid.pk}, content_type=JSON)
        assert response.status_code == 409
        paid.refresh_from_db()
        assert paid.expires_at is None

    def test_a_gift_that_is_not_there_says_so_without_saying_which(self, operator, db):
        assert operator.post(REVOKE, {"purchase_id": 9999}, content_type=JSON).status_code == 404


class TestPayouts:
    def _affiliate_with_a_balance(self, cents: int = 1170):
        priya = factories.UserFactory(email="priya@example.com", name="Priya")
        affiliates.code_for(priya)
        buyer = factories.UserFactory(email="buyer@example.com", referred_by=priya)
        factories.PurchaseFactory(
            user=buyer, status=Purchase.PAID, referrer=priya, commission_usd_cents=cents
        )
        return priya

    def test_the_list_is_most_owed_first_and_calls_out_a_missing_address(self, operator, db):
        priya = self._affiliate_with_a_balance()
        body = operator.get(PAYOUTS).json()

        assert [row["email"] for row in body["owed"]] == [priya.email]
        assert body["owed"][0]["balance"] == "$11.70"
        assert body["owed"][0]["paypal_email"] == ""
        assert body["owed"][0]["ready"] is False
        assert body["minimum"] == "$10.00"

    def test_recording_a_payout_lowers_the_balance(self, operator, db):
        priya = self._affiliate_with_a_balance()
        affiliates.set_paypal(priya, "priya@paypal.com")
        body = operator.post(
            PAYOUTS, {"user_id": priya.pk, "amount": "$10.00", "reference": "8KQ21P"}, content_type=JSON
        ).json()

        assert Payout.objects.get().amount_usd_cents == 1000
        assert body["owed"][0]["balance"] == "$1.70"
        assert body["recent"][0]["reference"] == "8KQ21P"

    def test_more_than_the_balance_is_refused(self, operator, db):
        priya = self._affiliate_with_a_balance()
        response = operator.post(PAYOUTS, {"user_id": priya.pk, "amount": "20"}, content_type=JSON)
        assert response.status_code == 409
        assert Payout.objects.count() == 0

    def test_an_amount_that_is_not_one_is_refused_before_anything_is_written(self, operator, db):
        priya = self._affiliate_with_a_balance()
        for typed in ("", "ten dollars", "1.234"):
            response = operator.post(PAYOUTS, {"user_id": priya.pk, "amount": typed}, content_type=JSON)
            assert response.status_code == 400, typed
        assert Payout.objects.count() == 0

    def test_an_account_that_is_not_an_affiliate_is_refused(self, operator, user):
        response = operator.post(PAYOUTS, {"user_id": user.pk, "amount": "5"}, content_type=JSON)
        assert response.status_code == 404

    def test_dollars_are_read_the_way_they_are_typed(self):
        assert services.parse_dollars("12.40") == 1240
        assert services.parse_dollars("$12") == 1200
        assert services.parse_dollars("1,200") == 120000
        assert services.parse_dollars("") is None
        assert services.parse_dollars("lots") is None


class TestOutreach:
    def test_the_message_promises_the_rate_the_code_actually_pays(self, operator, db):
        """A DM saying thirty percent while settlement pays twenty is the
        first thing a creator would catch us in."""
        body = operator.post(OUTREACH, {"name": "Ada", "url": "https://example.com/ada"}, content_type=JSON).json()
        assert f"{affiliates.percent()}%" in body["message"]
        assert "lifetime Pro" in body["message"]
        assert body["message"].startswith("Hi Ada,")

    def test_writing_the_row_is_the_memory_of_who_has_had_it(self, operator, db):
        operator.post(OUTREACH, {"name": "Ada"}, content_type=JSON)
        operator.post(OUTREACH, {"name": "Bo"}, content_type=JSON)
        rows = operator.get(OUTREACH).json()["rows"]
        assert [row["name"] for row in rows] == ["Bo", "Ada"]
        assert Outreach.objects.count() == 2

    def test_a_message_can_be_brought_back_without_writing_a_second_row(self, operator, db):
        operator.post(OUTREACH, {"name": "Ada"}, content_type=JSON)
        body = operator.get(OUTREACH, {"name": "Ada"}).json()
        assert body["message"].startswith("Hi Ada,")
        assert Outreach.objects.count() == 1

    def test_a_nameless_row_is_refused(self, operator, db):
        assert operator.post(OUTREACH, {"name": "  "}, content_type=JSON).status_code == 400
        assert Outreach.objects.count() == 0


def test_a_gift_is_never_announced(operator, db, channel):
    """The channel carries the six things somebody would act on today,
    and the operator giving a gift is the person who would have acted."""
    holder = factories.UserFactory(email="creator@example.com")
    operator.post(PRO, {"email": holder.email, "plan": plans.COMP}, content_type=JSON)
    assert channel.posted == []


def test_the_gift_list_holds_only_live_ones(operator, db):
    holder = factories.UserFactory(email="creator@example.com")
    row = gifts.grant(holder, plans.COMP_PASS)
    Purchase.objects.filter(pk=row.pk).update(expires_at=dt.datetime.now(dt.UTC) - dt.timedelta(days=1))
    assert operator.get(PRO).json()["gifts"] == []
