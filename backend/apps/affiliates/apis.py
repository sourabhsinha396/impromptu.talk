from django.conf import settings
from ninja import Router

from apps.affiliates import services
from apps.affiliates.schemas import PaypalIn, ProgrammeOut, ReferralsOut
from apps.authentication.security import session_auth
from apps.common.ratelimit import throttle

api = Router(tags=["affiliates"])


def _link(code: str) -> str:
    """The URL an affiliate hands out. No path, so the whole thing reads
    as the site's own name with one word after it."""
    return f"{settings.FRONTEND_ORIGIN.rstrip('/')}?ref={code}"


def _summary(found: services.Summary) -> dict:
    return {
        "referrals": found.referrals,
        "purchases": found.purchases,
        "earned": services.dollars(found.earned_cents),
        "paid": services.dollars(found.paid_cents),
        "balance": services.dollars(found.balance_cents),
        "payable": found.payable,
    }


@api.get("", auth=None, response=ProgrammeOut)
def programme(request):
    """What the public pitch prints, plus this account's own link when
    there is an account.

    Open on purpose: the pitch is mostly read by strangers, and ninja's
    auth would answer 401 to exactly the people it is written for. The
    code is minted here on the first look, because the link is shown
    rather than asked for.
    """
    user = request.user if request.user.is_authenticated else None
    code = services.code_for(user) if user else None
    return {
        "percent": services.percent(),
        "cookie_days": services.COOKIE_DAYS,
        "minimum_payout": services.dollars(services.MINIMUM_PAYOUT_CENTS),
        "code": code,
        "link": _link(code) if code else None,
    }


@api.get("/referrals", auth=session_auth, response=ReferralsOut)
def referrals(request):
    """One affiliate's own events and balance, in one call. Nobody is
    named: the people on this list did not sign up to be reported on."""
    user = request.user
    code = services.code_for(user)
    return {
        "code": code,
        "link": _link(code),
        "paypal_email": user.paypal_email,
        "percent": services.percent(),
        "minimum_payout": services.dollars(services.MINIMUM_PAYOUT_CENTS),
        "summary": _summary(services.summary(user)),
        "activity": [
            {
                "at": event.when.isoformat(),
                "kind": event.kind,
                "label": event.label,
                "amount": services.dollars(event.cents) if event.cents else "",
            }
            for event in services.activity(user)
        ],
        "payouts": [
            {
                "at": row.created_at.isoformat(),
                "amount": services.dollars(row.amount_usd_cents),
                "reference": row.reference,
            }
            for row in services.payouts(user)
        ],
    }


@api.post("/paypal", auth=session_auth, response=ReferralsOut)
@throttle("paypal", "20/hour")
def paypal(request, payload: PaypalIn):
    """Where a payout is sent. Blank clears it, which is how somebody
    stops us holding an address they no longer use. Answers with the
    whole page, as every other write here does."""
    services.set_paypal(request.user, payload.email)
    return referrals(request)
