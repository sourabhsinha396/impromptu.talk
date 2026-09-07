from django.http import HttpResponse
from ninja import Router

from apps.common.clock import request_offset
from apps.common.devices import device_id
from apps.common.ratelimit import throttle
from apps.runs import services, streaks
from apps.runs.schemas import RunIn, SummaryOut

api = Router(tags=["runs"])


def _who(request):
    return device_id(request), request.user if request.user.is_authenticated else None


# The rule a streak is counted under is the plan's: five days and no
# freezes free, the plan's length with freezes on Pro. Nobody is Pro until
# the entitlement card lands (24), which replaces this with the account's
# plan (`streaks.pro_rule(plan_days)`).
def _rule(user) -> streaks.Rule:
    return streaks.FREE


def _scoreboard(summary: streaks.Summary) -> dict:
    return {"streak": summary.streak, "topics": summary.topics, "minutes": summary.minutes}


@api.post("", response=SummaryOut)
# Keyed on the device rather than the address: a classroom behind one
# address is many speakers, and nothing may stand in front of the
# practice loop.
@throttle("runs", "120/hour", key=lambda request, **kwargs: device_id(request))
def record(request, payload: RunIn):
    """The one write the round makes, at the end. The answer is what the
    done screen shows next. Open to strangers on purpose: the streak is
    the reason to come back tomorrow, and it starts before an account."""
    did, user = _who(request)
    services.record(did, user, payload)
    return _scoreboard(streaks.summary(did, payload.tz_offset, user, _rule(user)))


@api.get("/summary", response=SummaryOut)
def summary(request, response: HttpResponse):
    """The same numbers the round was just told, for the header pill on
    every page. Today is read off the timezone cookie, since a page load
    carries no offset of its own. Private to the cookie, never cached."""
    did, user = _who(request)
    response["Cache-Control"] = "private, no-store"
    return _scoreboard(streaks.summary(did, request_offset(request), user, _rule(user)))
