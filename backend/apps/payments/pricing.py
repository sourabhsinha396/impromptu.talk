"""What Pro costs, wherever you are buying it from.

One price per plan is stored, in USD cents (apps/payments/plans.py), and
every other one is derived at read time from two numbers. The exchange
rate is the honest half: what a dollar is worth in the local currency.
The purchasing-power multiplier is the deliberate half: Rs 3,400 is what
$39 converts to and is not what $39 means in Delhi, so the rate is
discounted rather than applied straight.

Not every market gets discounted. The euro and sterling carry a
multiplier of 1.0 and convert straight, because discounting a market that
is not poorer than the one the price was set in is not purchasing-power
pricing, it is a sale. The multipliers are editorial, in the
neighbourhood of the purchasing-power conversion factor over the market
rate, rounded to something a person picked on purpose.

The rates are static. v0 could fetch live ones from an exchange-rate API
behind a lock and a cache; nothing ever needed that, and a price that
moves on its own between the page and the checkout is a support email, so
v1 keeps the table until a reason appears (docs/DECISIONS.md).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Market:
    """One place to buy from, and the arithmetic that gets it a price."""

    currency: str
    #: ISO-3166 alpha-2. The provider wants a billing country, and this is
    #: the default for somebody who picked the currency rather than being
    #: placed by a signal.
    country: str
    name: str
    symbol: str
    #: USD to this currency.
    rate: float
    #: Discount on top of the rate. 1.0 is a straight conversion.
    ppp: float
    #: Rounding step, in major units, because nobody prices anything at
    #: Rs 551.76.
    step: int
    #: Digits after the decimal point. The provider takes amounts in the
    #: currency's smallest unit, and not every currency has two.
    exponent: int = 2


# USD first: it is the base, the fallback, and what everybody the table
# does not name pays. Then the two that are simply large. The last five
# are the markets worth discounting for, where a straight conversion is
# the difference between a sale and a bounce.
#
# The euro has no one country; DE is the default billing country for
# somebody who picked the currency, and the checkout lets them correct it.
MARKETS: dict[str, Market] = {
    market.currency: market
    for market in (
        Market("USD", "US", "United States", "$", 1.0, 1.0, 1),
        Market("EUR", "DE", "Eurozone", "€", 0.86, 1.0, 1),
        Market("GBP", "GB", "United Kingdom", "£", 0.74, 1.0, 1),
        Market("INR", "IN", "India", "₹", 88.0, 0.33, 50),
        Market("BRL", "BR", "Brazil", "R$", 5.40, 0.48, 5),
        Market("PHP", "PH", "Philippines", "₱", 57.0, 0.38, 50),
        Market("MXN", "MX", "Mexico", "MX$", 18.5, 0.52, 10),
        Market("ZAR", "ZA", "South Africa", "R", 17.8, 0.45, 10),
    )
}

BASE_CURRENCY = "USD"

# How many the picker offers at once. Eight in a dropdown is a list to
# read; five is a glance, and the one in use is always among them.
VISIBLE = 5

# Most likely first. An editorial guess at where the money comes from,
# not a measurement: when there is real purchase data, sort by that.
BY_VOLUME = ("USD", "EUR", "INR", "GBP", "BRL", "MXN", "PHP", "ZAR")


class UnsupportedCurrency(ValueError):
    """A currency this site does not quote in."""


@dataclass(frozen=True)
class Price:
    """An amount and the two inputs that produced it, so a purchase row
    can still explain its own arithmetic years later."""

    amount_minor: int
    currency: str
    rate: float
    ppp: float

    @property
    def market(self) -> Market:
        return MARKETS[self.currency]

    @property
    def display(self) -> str:
        return display(self.amount_minor, self.currency)


def market(currency: str) -> Market:
    try:
        return MARKETS[currency.upper()]
    except (KeyError, AttributeError) as exc:
        raise UnsupportedCurrency(currency) from exc


def display(amount_minor: int, currency: str) -> str:
    """One amount, written the way that currency is written.

    A bare pair rather than a `Price`, because the amount most worth
    showing somebody is the one that was actually charged, and that
    arrives with no rate and no multiplier behind it: a receipt should
    read back the statement, not our arithmetic.

    A currency we have never quoted in is still printed. The provider
    converts at the card's end and is under no obligation to land inside
    our eight markets, and a receipt that raises because it was handed a
    dirham is worse in every way than one that says "45.00 AED".
    """
    code = (currency or "").upper()
    found = MARKETS.get(code)
    if found is None:
        return f"{amount_minor / 100:,.2f} {code}" if code else str(amount_minor)
    major = amount_minor / (10**found.exponent)
    return f"{found.symbol}{major:,.0f}"


def quote(currency: str, usd_cents: int) -> Price:
    """The price in `currency`. USD passes through untouched.

    Both arguments are required: there are four prices, so "the price" is
    a question rather than a default.
    """
    place = market(currency)
    if place.currency == BASE_CURRENCY:
        return Price(usd_cents, BASE_CURRENCY, 1.0, 1.0)
    major = usd_cents / 100 * place.rate * place.ppp
    # Never rounds to nothing: a cheap plan in a heavily discounted market
    # lands on the step rather than on zero.
    rounded = max(place.step, round(major / place.step) * place.step)
    return Price(rounded * 10**place.exponent, place.currency, place.rate, place.ppp)


def every_quote(usd_cents: int) -> list[Price]:
    """One price per market, in MARKETS order."""
    return [quote(currency, usd_cents) for currency in MARKETS]


def visible(currency: str) -> list[str]:
    """The currencies the picker offers: the most likely few, and always
    the one in use.

    A shopper from a small market does not lose their own price to make
    room for a bigger one; the currency in use displaces the last of the
    common ones rather than being dropped off the end.
    """
    top = [code for code in BY_VOLUME if code in MARKETS][:VISIBLE]
    if currency in top:
        return top
    return top[: VISIBLE - 1] + [currency]


# Country to currency, straight off the table above: every market names
# its own country, so this is a view of MARKETS rather than a second list
# to keep in step.
COUNTRY_CURRENCY: dict[str, str] = {place.country: place.currency for place in MARKETS.values()}


def currency_for(country: str) -> str:
    """What a visitor placed in `country` is quoted in, and the base
    currency for everybody the table does not name.

    Which of the eight markets, never where on earth. The ladder that
    works out the country in the first place (a trusted country header,
    the timezone cookie, then the language's region) lives once, in
    `frontend/lib/geo.ts`, because the frontend is what the browser
    actually reaches and it already answers the same question for the
    footer; porting its timezone table here would have been sixty lines
    of the same data in a second language (docs/DECISIONS.md).
    """
    return COUNTRY_CURRENCY.get((country or "").strip().upper(), BASE_CURRENCY)
