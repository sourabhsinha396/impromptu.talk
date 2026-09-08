"""Who has Pro, and what a plan may still be sold to them.

Two questions are kept apart everywhere here. `status` answers "did the
money land"; `expires_at` answers "is the access it bought still good".
A subscriber whose card failed is still a paid row, and their entitlement
has simply run out.

No network. A subscription whose stored expiry has passed is re-read from
the provider, and that lands with the checkout card (26) along with
everything else that talks to them; until then a lapsed row reads as
lapsed, which is what it is.
"""

import datetime as dt

from apps.payments import plans
from apps.payments.models import Purchase

# How long a subscription keeps working past its billing date. A renewal
# is not instant and a bank can sit on one overnight; locking somebody out
# of their own history while their money is in flight is the wrong error
# to make, and two days is long enough that it never happens.
GRACE = dt.timedelta(days=2)

# How often a lapsed subscription is re-read (card 26). Only rows that
# have already run out are ever re-read, so this is a ceiling on what one
# expired subscriber costs in calls, not a poll of anybody active.
RECHECK = dt.timedelta(hours=1)

HAS_FOREVER = "this account already has Pro for life"
HAS_SUBSCRIPTION = "this account already has a subscription"


def _paid_rows(user) -> list[Purchase]:
    """Every purchase that took money, newest first. Small by definition,
    since nobody buys Pro dozens of times, so expiry is decided in Python
    rather than in SQL against a stored timestamp."""
    return list(Purchase.objects.filter(user=user, status=Purchase.PAID))


def _live(row: Purchase, now: dt.datetime) -> bool:
    return row.expires_at is None or row.expires_at > now


def _best(rows: list[Purchase], now: dt.datetime) -> Purchase | None:
    """The row granting the most: forever beats a date, and a later date
    beats an earlier one. Somebody who subscribed and then bought lifetime
    should be told they have lifetime."""
    live = [row for row in rows if _live(row, now)]
    if not live:
        return None
    forever = [row for row in live if row.expires_at is None]
    if forever:
        return forever[0]
    return max(live, key=lambda row: row.expires_at)


def held(user, *, now: dt.datetime | None = None) -> Purchase | None:
    """The purchase currently granting Pro, or None. One query, and none
    at all for a stranger."""
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return _best(_paid_rows(user), now or dt.datetime.now(dt.UTC))


def is_pro(user, *, now: dt.datetime | None = None) -> bool:
    """Whether Pro's features are open to this account: a held purchase
    and nothing else.

    This used to read `not plans.selling() or held(...)`, so an unset
    provider key handed Pro to every signed-in account. The reasoning was
    that gating on a purchase nobody can make is a lock on a door with no
    key cut for it, and as a product argument it was fine. As a spend
    rule it was not: `is_pro` is what opens the one route that calls a
    model on somebody else's account, and a key going missing is exactly
    the moment it should close rather than open. Production now refuses
    to boot without `DODO_API_KEY` (owner's call), so the shut-shop state
    only exists in development and in tests, where nothing is billable.

    `streak_days` already read the held row alone, which meant two
    definitions of Pro sat side by side and disagreed whenever the shop
    was shut. There is one now.
    """
    return held(user, now=now) is not None


def plan_of(row: Purchase | None) -> plans.Plan | None:
    """The plan a row names, or None for a row naming a plan the catalogue
    has since dropped. A stored code is a fact about the day it was
    written, so an unknown one is read as "no plan we can describe" rather
    than raising on somebody's account page."""
    if row is None:
        return None
    try:
        return plans.plan(row.plan)
    except plans.UnknownPlan:
        return None


def streak_days(user, *, now: dt.datetime | None = None) -> int | None:
    """How many days of streak this account's plan tracks, or None for the
    free rule. The plan's own `tracks`, which is not its expiry: a monthly
    subscription never expires while it renews and still tracks a month.

    A held row and nothing else, unlike `is_pro` above: the shop being
    shut does not lengthen anybody's streak. Handing everybody 365 days
    while there is nothing to buy would drop them all to five on the day
    the first product id is set, which is a worse surprise than never
    having had it. A complimentary row is a held row, so Pro given by
    hand tracks like Pro bought.
    """
    found = plan_of(held(user, now=now))
    return found.tracks if found else None


def refusal(user, code: str) -> str:
    """Why this plan cannot be bought right now, or "" if it can.

    Deliberately narrow. Holding a thirty-day pass is no reason to refuse
    somebody lifetime, and a subscriber buying lifetime is an upgrade
    rather than a mistake. Only two things are refused: selling more to
    somebody who already owns it forever, and charging a second
    subscription to somebody already paying for one.

    The pricing page asks per plan so a card can say which thing is
    already held rather than going quiet, and the checkout asks again,
    because a page rendered five minutes ago is not permission.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return ""
    wanted = plans.plan(code)
    now = dt.datetime.now(dt.UTC)
    rows = _paid_rows(user)
    if any(_live(row, now) and row.expires_at is None for row in rows):
        return HAS_FOREVER
    if wanted.recurring and any(_live(row, now) and row.plan in plans.SUBSCRIPTION for row in rows):
        return HAS_SUBSCRIPTION
    return ""
