"""What is for sale, and what it costs everywhere.

The two price promises are pinned here because breaking either is a
pricing page that argues against itself, and neither would fail a test
that only checked the arithmetic.
"""

import pytest
from django.test import override_settings

from apps.payments import plans, pricing

KEYED = {"monthly": "prod_m", "annual": "prod_a", "pass": "prod_p", "lifetime": "prod_l"}


def test_the_pass_costs_more_than_a_subscribed_month():
    # On purpose: a month bought outright asks nothing of a card again, and
    # a pass priced under the subscription would make subscribing the
    # mistake. The pricing page has no way to explain that.
    assert plans.plan(plans.PASS).usd_cents > plans.plan(plans.MONTHLY).usd_cents


def test_annual_never_prices_at_or_above_lifetime():
    # Lifetime sits close above annual so it is the obvious pick. Equal
    # would make annual pointless; above would make it absurd.
    assert plans.plan(plans.ANNUAL).usd_cents < plans.plan(plans.LIFETIME).usd_cents


def test_the_gifts_are_free_and_can_never_reach_a_checkout():
    with override_settings(DODO_API_KEY="live", DODO_PRODUCTS=KEYED):
        for code in plans.COMPLIMENTARY:
            assert plans.plan(code).usd_cents == 0
            # No product id, which is the same switch that turns a real
            # plan off, so a gift cannot be sold by mistake.
            assert plans.product_id(code) == ""
            assert not plans.on_sale(code)


def test_the_gifts_are_not_in_the_catalogue_the_page_renders():
    codes = [plan.code for plan in plans.CATALOGUE]
    assert codes == [plans.MONTHLY, plans.ANNUAL, plans.PASS, plans.LIFETIME]
    assert plans.COMP not in codes and plans.COMP_PASS not in codes


def test_nothing_is_on_sale_without_a_key_or_without_its_own_product():
    with override_settings(DODO_API_KEY="", DODO_PRODUCTS=KEYED):
        assert not plans.selling()
        assert plans.sellable(plans.SUBSCRIPTION) == []
    with override_settings(DODO_API_KEY="live", DODO_PRODUCTS={**KEYED, "annual": ""}):
        # One plan switched off leaves the other on its card, rather than
        # the card half-working.
        assert [plan.code for plan in plans.sellable(plans.SUBSCRIPTION)] == [plans.MONTHLY]


def test_an_unknown_plan_code_is_refused_by_name():
    with pytest.raises(plans.UnknownPlan):
        plans.plan("free-forever-please")


def test_every_plan_tracks_a_streak_it_could_actually_last():
    # `tracks` is not `days`: a monthly subscription never expires while it
    # renews and still tracks a month. What must never happen is a plan
    # tracking more than the year the streak code will count.
    for plan in plans.PLANS.values():
        assert 1 <= plan.tracks <= 365


def test_the_dollar_price_passes_through_untouched():
    price = pricing.quote("USD", 3900)
    assert (price.amount_minor, price.currency, price.rate, price.ppp) == (3900, "USD", 1.0, 1.0)
    assert price.display == "$39"


def test_a_discounted_market_lands_on_a_round_number_in_its_own_units():
    # $39 converts to about Rs 3,432, which is not what $39 means in Delhi:
    # the multiplier is the deliberate half, and the step is what keeps the
    # answer off Rs 1,132.56.
    price = pricing.quote("INR", 3900)
    assert price.amount_minor % (50 * 100) == 0
    assert price.display == "₹1,150"
    assert price.ppp == 0.33


def test_the_euro_and_sterling_convert_straight():
    # Discounting a market that is not poorer than the one the price was
    # set in is not purchasing-power pricing, it is a sale.
    for code in ("EUR", "GBP"):
        assert pricing.quote(code, 3900).ppp == 1.0


def test_a_cheap_plan_in_a_heavy_market_never_rounds_away_to_nothing():
    for market in pricing.MARKETS.values():
        assert pricing.quote(market.currency, 1).amount_minor > 0


def test_a_currency_nobody_quotes_in_still_prints_on_a_receipt():
    # The provider converts at the card's end and is under no obligation to
    # land inside the eight markets. A receipt that raised on a dirham
    # would be worse in every way.
    assert pricing.display(4500, "AED") == "45.00 AED"
    with pytest.raises(pricing.UnsupportedCurrency):
        pricing.quote("AED", 3900)


def test_the_picker_shows_five_and_always_the_one_in_use():
    assert pricing.visible("USD") == list(pricing.BY_VOLUME[: pricing.VISIBLE])
    shown = pricing.visible("ZAR")
    assert len(shown) == pricing.VISIBLE
    # A shopper from a small market keeps their own price: it displaces the
    # last of the common ones rather than being dropped off the end.
    assert shown[-1] == "ZAR"


def test_a_country_outside_the_table_pays_the_base_currency():
    assert pricing.currency_for("IN") == "INR"
    assert pricing.currency_for("in") == "INR"
    # No market for it, so no better answer than the base currency.
    assert pricing.currency_for("NP") == "USD"
    assert pricing.currency_for("") == "USD"
