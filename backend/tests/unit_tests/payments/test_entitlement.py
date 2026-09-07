"""Who has Pro, what may still be sold to them, and what their streak
counts under.

Every test here runs with the shop open, because the interesting answers
are the ones a purchase decides. The shut-shop state has its own two
tests at the foot: it is what the site ships in today, and it is the one
that would be easy to get backwards.
"""

import datetime as dt

import pytest
from django.test import Client, override_settings

from apps.payments import plans, services
from apps.payments.models import Purchase
from apps.runs import streaks
from tests.unit_tests import factories

OPEN = override_settings(
    DODO_API_KEY="live",
    DODO_PRODUCTS={"monthly": "prod_m", "annual": "prod_a", "pass": "prod_p", "lifetime": "prod_l"},
)


@pytest.fixture
def shop_open():
    with OPEN:
        yield


def days_from_now(days: int) -> dt.datetime:
    return dt.datetime.now(dt.UTC) + dt.timedelta(days=days)


def test_an_account_with_nothing_is_not_pro_while_there_is_something_to_buy(user, shop_open):
    assert services.held(user) is None
    assert services.is_pro(user) is False


def test_a_stranger_is_never_pro_and_costs_no_query(shop_open, db):
    assert services.is_pro(None) is False


def test_money_that_did_not_land_grants_nothing(user, shop_open):
    factories.PurchaseFactory(user=user, status=Purchase.PENDING)
    factories.PurchaseFactory(user=user, status=Purchase.FAILED)
    factories.PurchaseFactory(user=user, status=Purchase.REFUNDED)
    assert services.is_pro(user) is False


def test_a_lifetime_row_never_runs_out(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    assert services.is_pro(user) is True
    assert services.held(user).plan == plans.LIFETIME


def test_an_expiry_in_the_past_is_not_pro_any_more_and_the_row_stays(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.PASS, expires_at=days_from_now(-1))
    assert services.is_pro(user) is False
    # Status and expiry are two questions: the money did land, and the
    # access it bought has run out.
    assert Purchase.objects.get(user=user).status == Purchase.PAID


def test_forever_beats_a_date_and_a_later_date_beats_an_earlier_one(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.PASS, expires_at=days_from_now(3))
    factories.PurchaseFactory(user=user, plan=plans.MONTHLY, expires_at=days_from_now(30))
    assert services.held(user).plan == plans.MONTHLY
    # Somebody who subscribed and then bought lifetime should be told they
    # have lifetime, not that they have a subscription.
    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    assert services.held(user).plan == plans.LIFETIME


def test_nothing_more_is_sold_to_somebody_who_owns_it_for_life(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    for code in (plans.MONTHLY, plans.ANNUAL, plans.PASS, plans.LIFETIME):
        assert services.refusal(user, code) == services.HAS_FOREVER


def test_a_subscriber_is_refused_a_second_subscription_and_offered_lifetime(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.MONTHLY, expires_at=days_from_now(30))
    assert services.refusal(user, plans.ANNUAL) == services.HAS_SUBSCRIPTION
    assert services.refusal(user, plans.MONTHLY) == services.HAS_SUBSCRIPTION
    # An upgrade, not a mistake. Holding a pass is no reason to refuse
    # anything either.
    assert services.refusal(user, plans.LIFETIME) == ""
    assert services.refusal(user, plans.PASS) == ""


def test_a_stranger_is_refused_nothing_because_the_page_has_to_render(shop_open, db):
    assert services.refusal(None, plans.LIFETIME) == ""


def test_a_plan_the_catalogue_has_dropped_reads_as_no_plan_rather_than_raising(user, shop_open):
    factories.PurchaseFactory(user=user, plan="interview-week")
    # Still Pro: the money landed and the access has not run out. What is
    # gone is only our ability to name what they bought.
    assert services.is_pro(user) is True
    assert services.plan_of(services.held(user)) is None
    assert services.streak_days(user) is None


def test_the_streak_is_counted_under_the_plans_length(user, shop_open):
    assert services.streak_days(user) is None
    factories.PurchaseFactory(user=user, plan=plans.MONTHLY, expires_at=days_from_now(30))
    # Not the expiry: a monthly subscription never expires while it
    # renews, and still tracks a month.
    assert services.streak_days(user) == 30
    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    assert services.streak_days(user) == 365


def test_pro_given_by_hand_tracks_like_pro_bought(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.COMP)
    assert services.is_pro(user) is True
    assert services.streak_days(user) == 365


def test_a_pro_account_sees_further_back_than_the_free_five_days(user, shop_open):
    factories.runs_on_days([0, 1, 2, 3, 4, 5, 6, 7], user=user)
    signed_in = Client()
    signed_in.force_login(user)

    free = signed_in.get("/api/v1/runs/history").json()
    assert free["streak"] == streaks.FREE_DAYS

    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    pro = signed_in.get("/api/v1/runs/history").json()
    assert pro["streak"] == 8
    assert len(pro["calendar"]) > len(free["calendar"])


def test_with_nothing_for_sale_everybody_has_pros_features(user):
    # The state the site ships in. Gating on a purchase nobody can make
    # would be a lock on a door with no key cut for it, and it is also
    # what hides "Get Pro" in the menu while there is no page to send
    # anybody to.
    assert plans.selling() is False
    assert services.is_pro(user) is True
    assert services.held(user) is None


def test_a_shut_shop_does_not_lengthen_anybodys_streak(user):
    # Handing everybody 365 days while there is nothing to buy would drop
    # them all to five the day the first product id is set.
    assert services.streak_days(user) is None


def test_the_account_payload_names_the_plan_rather_than_its_code(user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.MONTHLY, expires_at=days_from_now(30))
    signed_in = Client()
    signed_in.force_login(user)
    body = signed_in.get("/api/v1/auth/account").json()
    # What a plan is called is product policy, so the page is told rather
    # than keeping its own copy of the catalogue.
    assert body["plan"] == {
        "code": plans.MONTHLY,
        "name": "Monthly",
        "recurring": True,
        "note": plans.plan(plans.MONTHLY).note,
    }
    assert body["is_pro"] is True
