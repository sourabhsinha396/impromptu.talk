"""The pricing page's one call.

Priced server-side on purpose: the table, the multipliers and the
rounding are product policy, so the page prints what it is handed and
does no arithmetic of its own.
"""

import pytest
from django.test import Client, override_settings

from apps.payments import plans, pricing
from tests.unit_tests import factories

PLANS = "/api/v1/payments/plans"
KEYED = {"monthly": "prod_m", "annual": "prod_a", "pass": "prod_p", "lifetime": "prod_l"}
OPEN = override_settings(DODO_API_KEY="live", DODO_PRODUCTS=KEYED)


@pytest.fixture
def shop_open():
    with OPEN:
        yield


def cards(body) -> dict:
    return {card["kind"]: [plan["code"] for plan in card["plans"]] for card in body["cards"]}


def test_a_stranger_gets_the_whole_page_because_only_buying_needs_an_account(client, shop_open, db):
    body = client.get(PLANS).json()
    assert body["selling"] is True
    assert cards(body) == {"sub": ["monthly", "annual"], "one": ["pass", "lifetime"]}
    # Nothing is refused to somebody with no account: the page has to render.
    assert all(plan["refusal"] == "" for card in body["cards"] for plan in card["plans"])


def test_the_page_is_priced_in_the_currency_it_is_asked_for(client, shop_open, db):
    body = client.get(f"{PLANS}?currency=INR").json()
    assert body["currency"] == "INR"
    lifetime = next(p for p in body["cards"][1]["plans"] if p["code"] == "lifetime")
    assert lifetime["price"] == "₹1,150"
    assert lifetime["amount_minor"] == 115000


def test_a_currency_nobody_quotes_in_is_the_base_one_rather_than_a_blank_page(client, shop_open, db):
    # A page, not an API call somebody typed: a 400 over a bad query string
    # would be a pricing page that does not render.
    assert client.get(f"{PLANS}?currency=AED").json()["currency"] == "USD"
    assert client.get(f"{PLANS}?currency=").json()["currency"] == "USD"


def test_the_picker_offers_five_and_always_the_one_in_use(client, shop_open, db):
    body = client.get(f"{PLANS}?currency=ZAR").json()
    codes = [market["currency"] for market in body["currencies"]]
    assert len(codes) == pricing.VISIBLE
    assert codes[-1] == "ZAR"
    # The country travels because it is what names the flag beside the code.
    assert body["currencies"][0]["country"] == "US"


def test_a_card_with_nothing_on_sale_comes_back_empty_rather_than_missing(client, db):
    with override_settings(DODO_API_KEY="live", DODO_PRODUCTS={**KEYED, "pass": "", "lifetime": ""}):
        body = client.get(PLANS).json()
    # The card is still there and says it is not open; a card that
    # disappeared would read as a page that half-loaded.
    assert cards(body) == {"sub": ["monthly", "annual"], "one": []}


def test_with_no_key_nothing_is_for_sale_and_the_page_still_answers(client, db):
    body = client.get(PLANS).json()
    assert body["selling"] is False
    assert cards(body) == {"sub": [], "one": []}


def test_a_card_says_which_thing_this_account_already_holds(client, user, shop_open):
    factories.PurchaseFactory(user=user, plan=plans.LIFETIME)
    signed_in = Client()
    signed_in.force_login(user)
    body = signed_in.get(PLANS).json()
    everything = [plan for card in body["cards"] for plan in card["plans"]]
    assert all(plan["refusal"] == "this account already has Pro for life" for plan in everything)


def test_the_page_is_told_what_each_plan_tracks_and_what_free_tracks(client, shop_open, db):
    body = client.get(PLANS).json()
    tracks = {plan["code"]: plan["tracks"] for card in body["cards"] for plan in card["plans"]}
    assert tracks == {"monthly": 30, "annual": 365, "pass": 30, "lifetime": 365}
    # So the page can say what Pro is longer than without keeping its own
    # copy of the number.
    assert body["free_days"] == 5


def test_the_pass_is_not_called_monthly(client, shop_open, db):
    body = client.get(PLANS).json()
    names = {plan["code"]: plan["name"] for card in body["cards"] for plan in card["plans"]}
    # Two pills reading "Monthly" side by side is a riddle.
    assert names["pass"] == "30 day pass"
    assert names["monthly"] == "Monthly"
