"""The operator's tools, over the ordinary session.

Not the admin. That is Django's console over the tables and it is opened
by `is_staff`; these are tools that act on an account or a browser rather
than a row, and they are opened by `is_superuser`.

Every route here answers 404 to anybody who may not use it - a signed-out
stranger, a signed-in speaker and a mistyped path are told the same thing,
because a 403 confirms the path was guessed right. The gate is on the
routes and not only on the pages, since a page that hides a button is not
a permission.
"""

from ninja import Router, Status
from ninja.errors import HttpError

from apps.administration import services
from apps.administration.schemas import (
    GiftIn,
    OutreachIn,
    OutreachOut,
    PayoutIn,
    PayoutsOut,
    ProOut,
    RevokeIn,
)
from apps.affiliates import services as affiliates
from apps.authentication.models import User
from apps.authentication.security import superuser_auth
from apps.payments import gifts, plans
from apps.payments.models import Purchase

api = Router(tags=["administration"])

NO_ACCOUNT = "No account here uses {address}. They have to sign up first."
NOT_AN_AFFILIATE = "That account has no affiliate code."
GONE = "That gift is not here any more."
WHICH_ADDRESS = "Which address?"
HOW_MUCH = "How much? Dollars and cents, like 12.40."

# The two lengths on offer, in the order the page reads them. Forever
# first, because it is what this tool gets used for; the month is the
# apology and the trial.
LENGTHS = (plans.COMP, plans.COMP_PASS)


def _pro() -> dict:
    return {
        "lengths": [
            {
                "code": code,
                # Labelled by how long rather than by the plan's name:
                # `days` is already the truth about each one, so the two
                # can never disagree.
                "label": "Forever" if plans.plan(code).days is None else f"{plans.plan(code).days} days",
            }
            for code in LENGTHS
        ],
        "gifts": [
            {
                "id": row.pk,
                "email": row.user.email,
                "name": row.user.name,
                "plan": plans.plan(row.plan).name,
                "at": row.created_at.isoformat(),
                # Null is forever, which is the one thing about this row
                # that cannot be read off a date.
                "until": row.expires_at.isoformat() if row.expires_at else None,
            }
            for row in gifts.live()
        ],
    }


@api.get("/pro", auth=superuser_auth, response=ProOut)
def pro(request):
    return _pro()


@api.post("/pro", auth=superuser_auth, response=ProOut)
def give_pro(request, payload: GiftIn):
    """Give an existing account Pro, free.

    An address with no account is refused rather than signed up: making
    somebody an account from here would invent a password they have never
    seen and skip the verification the signup form does, and the person on
    the other end still could not get in.
    """
    address = payload.email.strip().lower()
    if not address:
        raise HttpError(400, WHICH_ADDRESS)
    holder = User.objects.filter(email=address).first()
    if holder is None:
        raise HttpError(404, NO_ACCOUNT.format(address=address))
    try:
        gifts.grant(holder, payload.plan)
    except plans.UnknownPlan as exc:
        raise HttpError(400, "That is not one of the two lengths.") from exc
    return _pro()


@api.post("/pro/revoke", auth=superuser_auth, response=ProOut)
def take_pro_back(request, payload: RevokeIn):
    """Stop one gift. `NotAGift` is the guard that matters: it is what
    stops this button ever expiring a purchase that took money."""
    row = Purchase.objects.filter(pk=payload.purchase_id).first()
    if row is None:
        raise HttpError(404, GONE)
    try:
        gifts.revoke(row)
    except gifts.NotAGift as exc:
        raise HttpError(409, gifts.NOT_A_GIFT) from exc
    return _pro()


def _payouts() -> dict:
    return {
        "minimum": affiliates.dollars(affiliates.MINIMUM_PAYOUT_CENTS),
        "owed": [
            {
                "user_id": row.user.pk,
                "email": row.user.email,
                "name": row.user.name,
                "paypal_email": row.user.paypal_email,
                "balance": affiliates.dollars(row.summary.balance_cents),
                "earned": affiliates.dollars(row.summary.earned_cents),
                "ready": row.ready,
            }
            for row in affiliates.owed()
        ],
        "recent": [
            {
                "at": payout.created_at.isoformat(),
                "email": payout.user.email,
                "amount": affiliates.dollars(payout.amount_usd_cents),
                "reference": payout.reference,
            }
            for payout in affiliates.Payout.objects.select_related("user")[:20]
        ],
    }


@api.get("/payouts", auth=superuser_auth, response=PayoutsOut)
def payouts(request):
    return _payouts()


@api.post("/payouts", auth=superuser_auth, response=PayoutsOut)
def record_payout(request, payload: PayoutIn):
    """Write down a transfer already made. Nothing here sends money: the
    money moves at PayPal and this is where it is written down after, the
    same order a refund follows and for the same reason."""
    cents = services.parse_dollars(payload.amount)
    if cents is None:
        raise HttpError(400, HOW_MUCH)
    who = User.objects.filter(pk=payload.user_id).first()
    if who is None or not who.affiliate_code:
        raise HttpError(404, NOT_AN_AFFILIATE)
    try:
        affiliates.record_payout(who, cents, payload.reference)
    except affiliates.NotOwed as exc:
        raise HttpError(409, str(exc)) from exc
    return _payouts()


def _outreach(message: str = "") -> dict:
    return {
        "message": message,
        "rows": [
            {"id": row.pk, "name": row.name, "url": row.url, "at": row.created_at.isoformat()}
            for row in services.recent()
        ],
    }


@api.get("/outreach", auth=superuser_auth, response=OutreachOut)
def outreach(request, name: str = ""):
    """The list, and the message for one name when a name is asked for,
    so a message can be brought back for somebody already written to."""
    return _outreach(services.message(name) if name.strip() else "")


@api.post("/outreach", auth=superuser_auth, response={201: OutreachOut})
def add_outreach(request, payload: OutreachIn):
    """Write the row and hand back the message. The row is the memory, so
    it is written when the message is asked for, which is the moment an
    operator is about to paste it."""
    name = payload.name.strip()
    if not name:
        raise HttpError(400, "Whose name goes at the top?")
    row = services.record(name, payload.url)
    return Status(201, _outreach(services.message(row.name)))
