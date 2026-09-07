import json

from django.http import Http404, HttpResponse
from ninja import File, Form, Router, Status, UploadedFile

from apps.authentication.security import session_auth
from apps.common.clock import request_offset
from apps.common.devices import device_id
from apps.common.ratelimit import throttle
from apps.payments import services as payments
from apps.runs import history, reports, services, sharing, streaks
from apps.runs import progress as progress_of
from apps.runs.models import Run
from apps.runs.schemas import HistoryOut, RecordedOut, ReportOut, RunIn, SharedOut, ShareOut, SummaryOut

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


@api.post("", response=RecordedOut)
# Keyed on the device rather than the address: a classroom behind one
# address is many speakers, and nothing may stand in front of the
# practice loop.
@throttle("runs", "120/hour", key=lambda request, **kwargs: device_id(request))
def record(request, payload: RunIn):
    """The one write the round makes, at the end. The answer is what the
    done screen shows next. Open to strangers on purpose: the streak is
    the reason to come back tomorrow, and it starts before an account."""
    did, user = _who(request)
    row = services.record(did, user, payload)
    return {"id": row.pk, **_scoreboard(streaks.summary(did, payload.tz_offset, user, _rule(user)))}


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
        "progress": _progress(did, user, _rule(user)),
    }


def _progress(did, user, rule) -> dict:
    """The trend, under the same window rule as the calendar beside it."""
    shown = progress_of.progress(did, user, rule)
    return {
        "enough": shown.enough,
        "needed": shown.needed,
        "counted": shown.counted,
        "points": [
            {"at": p.at.isoformat(), "stall": p.stall, "gap": p.gap, "fillers": p.fillers} for p in shown.points
        ],
        "first": _minute(shown.first),
        "latest": _minute(shown.latest),
    }


def _minute(minute) -> dict | None:
    if minute is None:
        return None
    return {"at": minute.at.isoformat(), "seconds": minute.seconds, "segments": minute.segments}


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


# A minute of mono Opus is a few hundred kilobytes and the longest round
# allowed is ten minutes, so this is the runaway ceiling and not a limit
# anybody meets. Refused before the file is read into memory.
MAX_AUDIO = 12 * 1024 * 1024


def _is_pro(user) -> bool:
    """Pro is what picks the transcriber and the allowance. The same
    question the streak rule asks, and asked the same way."""
    return bool(payments.streak_days(user))


@api.post("/{int:run_id}/report", response=ReportOut)
# The allowance is the real ceiling; this only stops a loop from filling a
# disk before the allowance has a chance to say no.
@throttle("reports", "120/hour", key=lambda request, **kwargs: device_id(request))
def attach_report(request, run_id: int, segments: Form[str], audio: File[UploadedFile | None] = None):
    """The report on a round, on its own call rather than folded into the
    run.

    The run POST answers instantly with day N and the streak, because that
    is the retention loop and nothing may stand in front of it. Transcribing
    takes seconds, so it happens here: the done screen shows the tiles at
    once and fills the report in when it arrives, and a provider having a
    day costs somebody their report and never their streak.

    Open to strangers, like the run it describes. A stranger practises and
    a stranger gets the timing half, which costs nothing to serve.
    """
    did, user = _who(request)
    # Owned by the same rule as everything else, and 404 rather than 403:
    # whether a run id exists is not a stranger's business.
    run = Run.objects.filter(services.owned_by(did, user), pk=run_id).first()
    if run is None:
        raise Http404
    if hasattr(run, "report"):
        raise Http404

    try:
        timeline = json.loads(segments)
        pairs = [(float(a), float(b)) for a, b in timeline]
    except (TypeError, ValueError):
        # A timeline no browser could have produced is refused at the edge,
        # the same as any other body: only a value no person could make.
        pairs = []

    blob = None
    if audio is not None and audio.size and audio.size <= MAX_AUDIO:
        blob = audio.read()

    pro = _is_pro(user)
    row = reports.make(run, pairs, pro=pro, audio=blob, filename=audio.name if audio else "round.webm")
    return reports.render(row, pro=pro)
