"""What is for sale, and the shape of each one.

Four plans, two shapes, and the difference is what it takes to believe
somebody has Pro. A one-time payment settles once and is true afterwards:
the row is the whole proof. A subscription is only true until the next
renewal, so its entitlement carries an expiry re-read from the provider
rather than remembered. That split is why `days` and `period` are two
fields rather than one clever one: `days` is what a payment buys outright,
`period` is how often the provider charges again.

Prices are here, in code, not in env as v0 kept them. Env holds secrets
and addresses; a price is product policy, reviewed like code, and a
number nobody can grep for is a number that gets edited on a server at
midnight. The product ids stay in env, because they are addresses at the
provider's end, and a missing one is how a plan is switched off.

Two more plans are given rather than sold: complimentary forever and a
complimentary month, what an operator hands out (card 32). They are plans
rather than a lifetime row priced at nothing, because the plan is what an
account page prints and what revenue is counted off, and a gift filed as
a sale is a number somebody has to correct by hand. Neither has a product
id, which is the same thing that switches a real plan off, so neither can
reach a checkout.
"""

from dataclasses import dataclass

from django.conf import settings

MONTHLY = "monthly"
ANNUAL = "annual"
PASS = "pass"
LIFETIME = "lifetime"

# The two that are given rather than sold, kept out of the catalogue the
# pricing page renders from.
COMP = "comp"
COMP_PASS = "comp-pass"


@dataclass(frozen=True)
class Plan:
    """One thing that can be bought, and everything true about it."""

    code: str
    #: What the pill calls it.
    name: str
    #: What follows the price on the card: "/month", "once", and so on.
    unit: str
    #: The base price, in USD cents. Zero for the two that are given.
    usd_cents: int
    #: How often the provider charges again, in their vocabulary. None for a
    #: payment that happens once, and that is what `recurring` reads.
    period: str | None
    #: Days of Pro one payment buys. None means forever, which is lifetime,
    #: and also what a subscription grants between renewals, where the
    #: expiry comes from the provider instead.
    days: int | None
    #: Days of streak this plan tracks (apps/runs/streaks.pro_rule). Not the
    #: same question as `days`: a monthly subscription never expires while it
    #: renews, and still tracks a month of streak. Free tracks five.
    tracks: int
    #: One line under the card's button. Whatever is true and least surprising.
    note: str

    @property
    def recurring(self) -> bool:
        return self.period is not None

    @property
    def forever(self) -> bool:
        return not self.recurring and self.days is None


# Order matters: it is the order the cards and their pills render in, and
# the first plan of each shape is the one a card opens on.
CATALOGUE: tuple[Plan, ...] = (
    Plan(
        code=MONTHLY,
        name="Monthly",
        unit="/month",
        usd_cents=500,
        period="month",
        days=None,
        tracks=30,
        note="Renews every month. Cancel whenever you like.",
    ),
    Plan(
        code=ANNUAL,
        name="Annual",
        unit="/year",
        usd_cents=2900,
        period="year",
        days=None,
        tracks=365,
        note="Renews once a year. Cancel whenever you like.",
    ),
    Plan(
        code=PASS,
        # v0 called this "Monthly" too, so both pills named a duration and
        # the card above them was what said whether it renews. Two pills
        # reading "Monthly" side by side is a riddle, and the card is not a
        # big enough clue (owner's call, docs/DECISIONS.md).
        name="30 day pass",
        unit="for 30 days",
        usd_cents=800,
        period=None,
        days=30,
        tracks=30,
        note="30 days of Pro. Nothing renews, nothing to cancel.",
    ),
    Plan(
        code=LIFETIME,
        name="Lifetime",
        unit="once",
        usd_cents=3900,
        period=None,
        days=None,
        tracks=365,
        note="Paid once. Yours for as long as the site exists.",
    ),
)

# The same two one-time shapes with no money behind them.
GIVEN: tuple[Plan, ...] = (
    Plan(
        code=COMP,
        name="Complimentary",
        unit="",
        usd_cents=0,
        period=None,
        days=None,
        tracks=365,
        note="Given, not bought.",
    ),
    Plan(
        code=COMP_PASS,
        name="Complimentary month",
        unit="",
        usd_cents=0,
        period=None,
        days=30,
        tracks=30,
        note="Given, not bought. One month of it.",
    ),
)

# Every plan a stored row may name, which is more than the four on offer.
PLANS: dict[str, Plan] = {plan.code: plan for plan in (*CATALOGUE, *GIVEN)}

# The two cards on the pricing page, each a shape rather than a plan.
SUBSCRIPTION = (MONTHLY, ANNUAL)
ONE_TIME = (PASS, LIFETIME)

# Not a card. It is what an operator may grant and take back, and that
# membership test is what keeps a real payment out of both: pulling Pro off
# a row that took money is a refund, and a refund starts at the provider.
COMPLIMENTARY = (COMP, COMP_PASS)


class UnknownPlan(ValueError):
    """A plan code no catalogue and no gift names."""


def plan(code: str) -> Plan:
    try:
        return PLANS[code]
    except KeyError as exc:
        raise UnknownPlan(code) from exc


def product_id(code: str) -> str:
    """The dashboard product this plan charges against, or "" if there is
    none, which is how a plan is switched off."""
    return settings.DODO_PRODUCTS.get(code, "")


def selling() -> bool:
    """Whether anything at all is for sale. With no key there is no Pro to
    buy, so nothing links to the pricing page and nothing is gated: the
    site says everything is free right now, and means it."""
    return bool(settings.DODO_API_KEY)


def on_sale(code: str) -> bool:
    """A key and a product for this plan specifically. Missing either
    leaves the card reading "not open yet" rather than half-working."""
    return selling() and bool(product_id(code))


def sellable(codes: tuple[str, ...]) -> list[Plan]:
    """The plans of one card that are actually on sale, in catalogue order.
    An empty list is what makes a card say it is not open."""
    return [PLANS[code] for code in codes if on_sale(code)]


def mode() -> str:
    """The word the checkout SDK wants for the host we talk to."""
    return "live" if "live." in settings.DODO_BASE_URL else "test"
