"""The affiliate programme: a link for every account, and what it earns.

Three questions, and where each is answered.

**Whose link was it?** A code in `?ref=`, which the frontend keeps in a
cookie for sixty days. It is spent at two moments and no others: when an
account is made, which writes `referred_by` and freezes it, and when a
checkout opens, which writes `Purchase.referrer`. The account's own
referrer wins over the cookie, so the affiliate who brought somebody in
keeps them when a second link is clicked a month later; the cookie is the
fallback for a buyer who had an account before they clicked anything.
Nobody is ever credited with themselves.

**What did it earn?** Thirty percent of what the purchase actually paid
us, in dollars, off the charge and never off the list price: a lifetime
bought in rupees at a third of the list earns thirty percent of the
rupees. Written onto the purchase at settlement and frozen there, like
every other number on that row. A subscription's renewals never become
rows here - there is no webhook to hear them - so a subscription earns on
its first charge, and the page says so.

**What is owed?** Earned less paid, counted from rows every time it is
asked. There is no balance column: a stored one drifts the first time a
refund lands after a payout, and a refund here is one status flip that
nothing has to be told about.
"""

import datetime as dt
import re
import secrets
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils.text import slugify

from apps.affiliates.models import Payout
from apps.authentication.models import User
from apps.common.referrals import valid_code
from apps.payments import services as payments
from apps.payments.models import Purchase

# The rate, in basis points, and the only place it is written. The page,
# the FAQ and the outreach message all read it from here, because a
# number promised in a DM that settlement does not pay is the first thing
# a creator would catch us in.
COMMISSION_BPS = 3000

# How long a click is remembered, and the frontend writes the cookie for
# the same span. Two months is long enough that somebody who read a post,
# practised free for a few weeks and then bought is still credited to the
# person who sent them, which is the case an affiliate is actually
# promised.
COOKIE_DAYS = 60

# Below this nothing is sent: a transfer has a fee and a person behind it,
# and a balance of forty cents is worth neither.
MINIMUM_PAYOUT_CENTS = 1000

# How many events the referrals page lists.
RECENT = 100

# Room left for the digits that follow a stem somebody else already has.
STEM_MAX = 16
CODE_MIN = 2
FALLBACK_STEM = "speaker"

SIGNUP = "signup"
PURCHASE = "purchase"
REFUND = "refund"

NOTHING_OWED = "There is nothing owed to pay out."


class NotOwed(Exception):
    """A payout that is not one: nothing, or more than the balance."""


def percent() -> int:
    """The rate as a page prints it."""
    return COMMISSION_BPS // 100


def dollars(cents: int) -> str:
    """Commission is in cents and is written with them: `pricing.display`
    rounds to whole units, which is right for a price and wrong for a
    balance of $7.80."""
    sign = "-" if cents < 0 else ""
    return f"{sign}${abs(cents) / 100:,.2f}"


# ── the code ─────────────────────────────────────────────────────────────


def _stem(user: User) -> str:
    """The word a code is built from: the first name, or failing that the
    front of the address with its dots and pluses taken out."""
    first = slugify(user.name or "").split("-")[0][:STEM_MAX]
    if len(first) >= CODE_MIN:
        return first
    local = re.sub(r"[^a-z0-9]", "", user.email.split("@")[0].lower())[:STEM_MAX]
    if len(local) >= CODE_MIN:
        return local
    return FALLBACK_STEM


def _free_code(stem: str) -> str:
    """The stem itself when it is free - alex - and the stem with a couple
    of digits when it is not - alex28. More digits as the short ones fill
    up, and a hex tail if a name is somehow taken ten times over."""
    if not User.objects.filter(affiliate_code=stem).exists():
        return stem
    for width in (2, 2, 2, 3, 3, 4, 5, 6):
        guess = f"{stem}{secrets.randbelow(10**width):0{width}d}"
        if not User.objects.filter(affiliate_code=guess).exists():
            return guess
    return f"{stem}{secrets.token_hex(4)}"


def code_for(user: User) -> str:
    """This account's code, minted on the first ask and handed back on
    every ask after.

    Idempotent and safe from a GET: the code is the link, and a link is
    shown rather than requested, so the first look at the account page is
    what creates it. The unique column is the guard against two requests
    doing it at once - whichever landed first is the code, and the other
    reads it back. Never changed once minted, because by then it is
    printed in somebody's posts.
    """
    if user.affiliate_code:
        return user.affiliate_code
    stem = _stem(user)
    for _ in range(3):
        try:
            with transaction.atomic():
                user.affiliate_code = _free_code(stem)
                user.save(update_fields=["affiliate_code"])
            return user.affiliate_code
        except IntegrityError:
            user.refresh_from_db(fields=["affiliate_code"])
            if user.affiliate_code:
                return user.affiliate_code
    raise RuntimeError(f"could not mint an affiliate code for user {user.pk}")


def by_code(code: str | None) -> User | None:
    """The account a code names, or nobody. The shape is refused before
    the query rather than trusted to the column: a value that crossed a
    cookie header is not one this process wrote."""
    checked = valid_code(code)
    if not checked:
        return None
    return User.objects.filter(affiliate_code=checked).first()


def set_paypal(user: User, email: str) -> User:
    """Where a payout is sent. Blank clears it, which is how somebody
    stops us holding an address they no longer use."""
    user.paypal_email = (email or "").strip()[:254]
    user.save(update_fields=["paypal_email"])
    return user


# ── attribution ──────────────────────────────────────────────────────────


def referrer_for(user: User, code: str) -> User | None:
    """Who a purchase by this account is credited to, or nobody.

    The account's own referrer first: they brought the buyer in, and a
    second affiliate's link clicked since does not take the sale off
    them. The cookie is the fallback for a buyer who had an account
    before they clicked anything at all. Never the buyer, because a
    discount code is a different feature and would be sold as one.
    """
    if user.referred_by_id is not None and user.referred_by_id != user.pk:
        return user.referred_by
    found = by_code(code)
    if found is None or found.pk == user.pk:
        return None
    return found


# ── what it earned ───────────────────────────────────────────────────────


def usd_value_cents(row: Purchase) -> int:
    """What this purchase was worth to us, in cents of the base currency.

    The charge when it is known and the quote when it is not, converted
    back to dollars at the rate frozen on the row when the money came in
    the currency we quoted, because that is the rate the price was built
    from. When a buyer switched currency at the provider's end, the rate
    they converted at is theirs and not ours to know, so today's table is
    the nearest honest figure; a currency no market here prices falls
    back to the quote, which is a number we did author.
    """
    from apps.payments import pricing

    minor = row.charged_minor if row.charged_minor is not None else row.amount_minor
    currency = (row.charged_currency or row.currency or pricing.BASE_CURRENCY).upper()
    if currency == pricing.BASE_CURRENCY:
        return minor
    if currency == (row.currency or "").upper() and row.fx_rate:
        return round(minor / row.fx_rate)
    market = pricing.MARKETS.get(currency)
    if market is None or not market.rate:
        return row.usd_cents
    return round(minor / market.rate)


def commission_cents(row: Purchase) -> int:
    """Thirty percent of what the sale was worth, off the charge."""
    return round(usd_value_cents(row) * COMMISSION_BPS / 10_000)


@dataclass(frozen=True)
class Summary:
    """The four numbers on the referrals page."""

    referrals: int
    purchases: int
    earned_cents: int
    paid_cents: int

    @property
    def balance_cents(self) -> int:
        return self.earned_cents - self.paid_cents

    @property
    def payable(self) -> bool:
        return self.balance_cents >= MINIMUM_PAYOUT_CENTS


@dataclass(frozen=True)
class Event:
    """One line of the referrals list. `cents` is what it did to the
    balance: positive for a purchase, negative for the refund of one,
    nothing for an account that has only signed up."""

    when: dt.datetime
    kind: str
    label: str
    cents: int


def _credited(user: User) -> list[Purchase]:
    """Every purchase credited to this affiliate that took money, refunds
    included, newest first. Pending and failed rows are nobody's
    business."""
    return list(
        Purchase.objects.filter(referrer=user, status__in=(Purchase.PAID, Purchase.REFUNDED)).order_by(
            "-created_at", "-id"
        )
    )


def summary(user: User) -> Summary:
    paid = [row for row in _credited(user) if row.status == Purchase.PAID]
    sent = Payout.objects.filter(user=user).aggregate(total=Sum("amount_usd_cents"))["total"] or 0
    return Summary(
        referrals=User.objects.filter(referred_by=user).count(),
        purchases=len(paid),
        earned_cents=sum(row.commission_usd_cents or 0 for row in paid),
        paid_cents=int(sent),
    )


def activity(user: User, limit: int = RECENT) -> list[Event]:
    """What this affiliate's link has done, newest first.

    Nobody is named. The people on this list did not sign up to be
    reported on, so an account is "New account" and a purchase is the
    plan it bought, which is what the affiliate is paid on and all they
    need to see.
    """
    events = [
        Event(when, SIGNUP, "New account", 0)
        for when in User.objects.filter(referred_by=user).values_list("created_at", flat=True)
    ]
    for row in _credited(user):
        found = payments.plan_of(row)
        name = found.name if found else row.plan
        cents = row.commission_usd_cents or 0
        when = row.verified_at or row.created_at
        if row.status == Purchase.REFUNDED:
            events.append(Event(when, REFUND, f"{name}, refunded", -cents))
        else:
            events.append(Event(when, PURCHASE, f"{name} bought", cents))
    events.sort(key=lambda event: event.when, reverse=True)
    return events[:limit]


# ── payouts ──────────────────────────────────────────────────────────────


def payouts(user: User) -> list[Payout]:
    return list(Payout.objects.filter(user=user))


def record_payout(user: User, cents: int, reference: str = "") -> Payout:
    """Write down a transfer that has already been made.

    Refuses more than is owed. An operator can send anything they like
    from the PayPal dashboard, but a row larger than the balance is a
    typo nine times in ten, and the tenth time it is a decision worth a
    second row.
    """
    if cents <= 0:
        raise NotOwed(NOTHING_OWED)
    balance = summary(user).balance_cents
    if cents > balance:
        raise NotOwed(f"{dollars(cents)} is more than the {dollars(balance)} owed.")
    return Payout.objects.create(user=user, amount_usd_cents=cents, reference=reference.strip()[:120])


@dataclass(frozen=True)
class Owed:
    """One affiliate as the payouts tool sees them (card 32)."""

    user: User
    summary: Summary

    @property
    def ready(self) -> bool:
        """Enough to send, and somewhere to send it."""
        return self.summary.payable and bool(self.user.paypal_email)


def owed() -> list[Owed]:
    """Every affiliate whose link has earned anything, most owed first.

    Not only the ones over the minimum: this list is also how an operator
    sees who is sitting on a balance with no address to send it to, which
    is a support mail waiting to happen.
    """
    out = [Owed(user, summary(user)) for user in User.objects.exclude(affiliate_code=None)]
    out = [each for each in out if each.summary.earned_cents > 0]
    out.sort(key=lambda each: (-each.summary.balance_cents, each.user.email))
    return out
