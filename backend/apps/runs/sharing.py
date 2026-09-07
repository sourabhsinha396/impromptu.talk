"""A public link to somebody's practice.

The whole feature is one nullable column on the account. Null means no
page, which is the default: a streak is private until its owner decides
otherwise, and a deploy that turned everyone's history public would be a
change of terms rather than a share button.

The token is unguessable rather than secret in transit. It travels in a
URL somebody pastes into a chat, so it has to survive being seen by the
people it was shown to and resist being found by people it was not.

The page shows the same eight weeks to everybody, whatever the owner's
plan: a shared page is not a tier, and a heatmap of five squares is not
something anybody sends. A lapsed Pro's link keeps working with the same
eight weeks, for the same reason (`PRICING.md` §6).
"""

import secrets

from apps.authentication.models import User
from apps.runs import streaks
from apps.runs.history import history
from apps.runs.models import Run
from apps.runs.services import owned_by
from apps.topics.models import Topic

# 16 bytes as base64url: 128 bits, which is not a thing anybody enumerates,
# and short enough to sit in a message without wrapping.
TOKEN_BYTES = 16

# A separate constant from the free window on purpose. Pointing the page at
# the free window would silently shrink every card ever sent the next time
# the free calendar moved.
SHARED_DAYS = 56

# How many recently practised topics the page names.
SHARED_RECENT = 8


def start(user) -> str:
    """Turn sharing on, or hand back the link already in use. Idempotent:
    pressing the button twice must not break a link somebody already sent."""
    if not user.share_token:
        user.share_token = secrets.token_urlsafe(TOKEN_BYTES)
        user.save(update_fields=["share_token"])
    return user.share_token


def stop(user) -> None:
    """Turn sharing off. The token is cleared, so the link somebody was
    sent stops working the moment the switch moves, and sharing again
    mints a new one. The alternative was parking the token and handing
    the same link back, which would have quietly let everybody holding
    the old one back in the second sharing was turned on again: an off
    switch has to mean the URL you already sent is dead."""
    if user.share_token:
        user.share_token = None
        user.save(update_fields=["share_token"])


def owner(token: str):
    """Whose page this is, or None. An empty token would otherwise match
    every account that has never shared, so it is refused before the
    query rather than trusted to the column."""
    if not token:
        return None
    return User.objects.filter(share_token=token).first()


def shared(user, offset_minutes: int = 0, *, now=None) -> dict:
    """The page, as a stranger may see it. Only bank topics are named: a
    bank topic is one `/?topic=<slug>` hands straight back, so naming it
    gives away nothing and the link is worth having. A sentence somebody
    wrote for themselves is not ours to publish, whatever is in it."""
    rule = streaks.Rule(days=SHARED_DAYS, freezes=False, runs=SHARED_RECENT)
    shown = history("shared", offset_minutes, user, rule, now=now)
    recent = _bank_topics(user, SHARED_RECENT)
    return {
        "name": user.name,
        "streak": streaks.summary("shared", offset_minutes, user, now=now).streak,
        "topics": shown.summary.topics,
        "minutes": shown.summary.minutes,
        "days": SHARED_DAYS,
        "calendar": [{"date": d.date.isoformat(), "count": d.count, "frozen": False} for d in shown.calendar],
        "recent": recent,
    }


def _bank_topics(user, limit: int) -> list[dict]:
    texts = list(
        Run.objects.filter(owned_by("shared", user))
        .order_by("-created_at", "-id")
        .values_list("topic_text", flat=True)[: limit * 4]
    )
    if not texts:
        return []
    bank = Topic.objects.filter(genre__owner__isnull=True, text__in=set(texts))
    slugs = dict(bank.values_list("text", "slug"))
    out: list[dict] = []
    seen: set[str] = set()
    for text in texts:
        if text in slugs and text not in seen:
            seen.add(text)
            out.append({"text": text, "slug": slugs[text]})
        if len(out) == limit:
            break
    return out
