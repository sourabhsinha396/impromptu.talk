from ninja import Router

from apps.common.devices import device_id
from apps.common.ratelimit import throttle
from apps.runs import services, streaks
from apps.runs.schemas import RunIn, SummaryOut

api = Router(tags=["runs"])


@api.post("", response=SummaryOut)
# Keyed on the device rather than the address: a classroom behind one
# address is many speakers, and nothing may stand in front of the
# practice loop.
@throttle("runs", "120/hour", key=lambda request, **kwargs: device_id(request))
def record(request, payload: RunIn):
    """The one write the round makes, at the end. The answer is what the
    done screen shows next. Open to strangers on purpose: the streak is
    the reason to come back tomorrow, and it starts before an account."""
    did = device_id(request)
    user = request.user if request.user.is_authenticated else None
    services.record(did, user, payload)
    topics, minutes = services.totals(did, user)
    return {"streak": streaks.current_streak(did, payload.tz_offset, user), "topics": topics, "minutes": minutes}
