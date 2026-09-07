from django.conf import settings
from django.http import Http404
from ninja import Router, Status
from ninja.errors import HttpError

from apps.authentication.security import session_auth
from apps.common.ratelimit import throttle
from apps.payments import checkout, plans, pricing, services
from apps.payments.dodo import DodoError
from apps.payments.schemas import CatalogueOut, CheckoutIn, CheckoutOut, ReceiptOut, SettleIn
from apps.runs.streaks import FREE_DAYS

CHECKOUT_FAILED = "Could not open a checkout. Try again in a minute."
PORTAL_FAILED = "Could not open the billing portal. Try again in a minute."

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


@api.post("/checkout", auth=session_auth, response=CheckoutOut)
# Per account: opening a checkout costs the provider a session and us a
# pending row, and nobody buys Pro ten times in an hour.
@throttle("checkout", "10/hour", key=lambda request, **kwargs: str(request.auth.pk))
def start_checkout(request, payload: CheckoutIn):
    try:
        _, url = checkout.start(
            request.auth,
            plan_code=payload.plan,
            currency=payload.currency or pricing.BASE_CURRENCY,
            referrer=None,  # card 31 decides this from the cookie
        )
    except plans.UnknownPlan as exc:
        raise HttpError(400, "No such plan.") from exc
    except checkout.NotForSale as exc:
        raise HttpError(400, str(exc)) from exc
    except DodoError as exc:
        raise HttpError(502, CHECKOUT_FAILED) from exc
    return {"url": url}


@api.post("/settle", auth=session_auth, response=ReceiptOut)
def settle(request, payload: SettleIn):
    """The done page, and the only thing that moves a row to paid.

    Idempotent: a settled row short-circuits, so a reload re-grants
    nothing. The ids in the body are the return URL's and are trusted for
    nothing beyond naming what to go and read.
    """
    row = checkout.by_reference(request.auth, payload.reference)
    if row is None:
        raise Http404
    try:
        row = checkout.verify(row, payment_id=payload.payment_id, subscription_id=payload.subscription_id)
    except DodoError:
        # Unreachable is not unpaid. The row stays pending and the link in
        # the receipt settles it whenever they come back.
        pass
    return _receipt(row)


@api.post("/portal", auth=session_auth, response=CheckoutOut)
def portal(request):
    try:
        url = checkout.portal_link(request.auth, f"{settings.FRONTEND_ORIGIN}/account?back=portal")
    except DodoError as exc:
        raise HttpError(502, PORTAL_FAILED) from exc
    return {"url": url}


def _receipt(row) -> dict:
    plan = services.plan_of(row)
    charged_minor = row.charged_minor if row.charged_minor is not None else row.amount_minor
    return {
        "reference": row.reference,
        "plan_name": plan.name if plan else row.plan,
        "recurring": plan.recurring if plan else False,
        "status": row.status,
        "charged": pricing.display(charged_minor, row.charged_currency or row.currency),
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
    }


@api.post("/refresh", auth=session_auth, response={204: None})
def refresh(request):
    """Re-read whatever has run out. Called on the way back from the
    portal, which is one of the two moments the answer can have changed."""
    checkout.catch_up(request.auth)
    return Status(204, None)
