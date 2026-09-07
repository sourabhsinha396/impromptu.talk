from ninja import Router

from apps.payments import plans, pricing, services
from apps.payments.schemas import CatalogueOut
from apps.runs.streaks import FREE_DAYS

api = Router(tags=["payments"])

# Each card is a shape rather than a plan, and the pill switches between
# the two plans inside it. The order is the catalogue's.
CARDS = (("sub", "Subscription", plans.SUBSCRIPTION), ("one", "One-time", plans.ONE_TIME))


@api.get("/plans", auth=None, response=CatalogueOut)
def catalogue(request, currency: str = ""):
    """The pricing page, priced for whoever is asking.

    Open to strangers: the page is public and only the buying needs an
    account. `auth=None` is explicit because the refusal below reads the
    session when there is one, and a route that silently required it
    would turn the pricing page into a sign-in wall.

    The currency arrives from the frontend, which owns the ladder that
    works it out (a picked one first, then where the visitor is). An
    unknown code is quoted in the base currency rather than refused: this
    is a page, and a 400 here would be a blank page over a typo.
    """
    # Django's own middleware puts the account on the request, so an
    # open route can still read one where there is one; ninja's `auth`
    # would answer 401 to the stranger this page is mostly for.
    user = request.user
    try:
        code = pricing.market(currency).currency
    except pricing.UnsupportedCurrency:
        code = pricing.BASE_CURRENCY

    return {
        "selling": plans.selling(),
        "currency": code,
        "currencies": [pricing.MARKETS[name] for name in pricing.visible(code)],
        "cards": [
            {
                "kind": kind,
                "title": title,
                "plans": [_priced(plan, code, user) for plan in plans.sellable(codes)],
            }
            for kind, title, codes in CARDS
        ],
        "free_days": FREE_DAYS,
    }


def _priced(plan: plans.Plan, currency: str, user) -> dict:
    price = pricing.quote(currency, plan.usd_cents)
    return {
        "code": plan.code,
        "name": plan.name,
        "unit": plan.unit,
        "note": plan.note,
        "recurring": plan.recurring,
        "price": price.display,
        "amount_minor": price.amount_minor,
        "tracks": plan.tracks,
        "refusal": services.refusal(user, plan.code),
    }
