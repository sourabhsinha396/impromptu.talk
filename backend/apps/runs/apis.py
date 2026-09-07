from django.http import Http404, HttpResponse
from ninja import Router, Status

from apps.authentication.security import session_auth
from apps.common.clock import request_offset
from apps.common.devices import device_id
from apps.common.ratelimit import throttle
from apps.payments import services as payments
from apps.runs import history, services, sharing, streaks
from apps.runs.schemas import HistoryOut, RunIn, SharedOut, ShareOut, SummaryOut

api = Router(tags=["runs"])


def _who(request):
    return device_id(request), request.user if request.user.is_authenticated else None


# The rule a streak is counted under is the plan's: five days and no
# freezes free, the plan's length with freezes on Pro. One query for an
# account, none at all for a stranger, who cannot hold a plan.
def _rule(user) -> streaks.Rule:
    days = payments.streak_days(user)
    return streaks.pro_rule(days) if days else streaks.FREE


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


@api.get("/history", response=HistoryOut)
def practice(request, response: HttpResponse):
    """Everything the streak page shows, in one answer: the calendar is as
    long as the plan tracks and the list as long as the plan keeps. Whose
    runs is settled by the cookies, as everywhere else."""
    did, user = _who(request)
    response["Cache-Control"] = "private, no-store"
    shown = history.history(did, request_offset(request), user, _rule(user))
    return {
        "streak": shown.summary.streak,
        "longest": shown.summary.longest,
        "topics": shown.summary.topics,
        "minutes": shown.summary.minutes,
        "would_be": shown.summary.would_be,
        "days": shown.days,
        "runs_kept": shown.runs_kept,
        "calendar": [{"date": d.date.isoformat(), "count": d.count, "frozen": d.frozen} for d in shown.calendar],
        "recent": [
            {"topic_text": r.topic_text, "genre_slug": r.genre_slug, "at": r.at.isoformat()} for r in shown.recent
        ],
        "share_token": user.share_token if user else None,
    }


@api.post("/share", auth=session_auth, response=ShareOut)
def share(request):
    """Turn the public page on, or hand back the link already in use. An
    account is needed because the link has to outlive the browser that
    made it; a stranger is told 401."""
    return {"token": sharing.start(request.auth)}


@api.delete("/share", auth=session_auth, response={204: None})
def unshare(request):
    """Turn the public page off, from the account's additional settings.
    The link dies at once; sharing again makes a new one. Idempotent, so
    a second press on a slow connection is not an error."""
    sharing.stop(request.auth)
    return Status(204, None)


@api.get("/shared/{token}", response=SharedOut)
def shared_page(request, token: str, response: HttpResponse):
    """One person's practice for anybody with the link. 404 for a token
    nobody holds, the same as a page that never existed."""
    who = sharing.owner(token)
    if who is None:
        raise Http404
    response["Cache-Control"] = "private, no-store"
    return sharing.shared(who, request_offset(request))
