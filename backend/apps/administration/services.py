"""The operator's tools, and the words one of them prints.

The pitch to a creator lives here rather than in a page so there is one
copy of it, and so a test can hold the two promises it makes - lifetime
Pro and the affiliate rate - to what the code actually gives. The rate in
particular is read off the same constant settlement pays, because a DM
saying thirty percent while settlement pays twenty is the first thing a
creator would catch us in.
"""

from apps.administration.models import Outreach
from apps.affiliates.services import percent

# How many names the list shows. Long rather than paged: the list is how
# an operator avoids writing to the same person twice, and a page two
# nobody clicks is the same as no memory at all.
RECENT = 200

# The message, with the two blanks it has. Written for a creator who
# already makes impromptu reels: they know what the domain means, so it
# does not explain the site. One ask at the end, and it is a question with
# an easy answer.
TEMPLATE = """Hi {name},

Your reels on impromptu are the reason I'm writing. I built yapholic.com.

Sign up, reply with the email you used, and I'll put you on lifetime Pro.
That lets you write your own topics, so followers could practise "{name}'s topics" instead of my generic ones.

You also get a referral link, and it pays {percent}% of every Pro purchase. Not the reason to try it, but it's there.

One ask: do give it a try and tell me what annoyed you.

Thanks,
Sourabh"""


def message(name: str) -> str:
    """The pitch, addressed. The name is used as typed."""
    return TEMPLATE.format(name=name.strip(), percent=percent())


def record(name: str, url: str = "") -> Outreach:
    return Outreach.objects.create(name=name.strip()[:120], url=url.strip()[:300])


def recent(limit: int = RECENT) -> list[Outreach]:
    return list(Outreach.objects.all()[:limit])


def parse_dollars(text: str) -> int | None:
    """An amount typed by hand - 12.40, $12, 12 - as cents, or None.

    Typed rather than taken from the balance on purpose: the balance is a
    suggestion and not an instruction, since PayPal takes a fee off some
    transfers and an operator may round.
    """
    cleaned = (text or "").strip().replace("$", "").replace(",", "")
    if not cleaned:
        return None
    try:
        whole, _, fraction = cleaned.partition(".")
        if not whole.isdigit() and whole not in ("", "-"):
            return None
        if fraction and (not fraction.isdigit() or len(fraction) > 2):
            return None
        return int(round(float(cleaned) * 100))
    except ValueError:
        return None
