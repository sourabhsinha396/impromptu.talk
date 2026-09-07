from ninja import Field, Schema

from apps.runs.models import MAX_OFFSET, MAX_SECONDS


class RunIn(Schema):
    """What the browser reports at the end of a round. Every field is
    required and bounded, because this is the shape a request body is
    checked against; only a value no person could have produced is
    refused, and it is refused here rather than as a 500 later."""

    topic_text: str = Field(min_length=1, max_length=200)
    genre_slug: str = Field(min_length=1, max_length=60)
    prep_seconds: int = Field(ge=0, le=MAX_SECONDS)
    speak_seconds: int = Field(ge=0, le=MAX_SECONDS)
    spoken_seconds: int = Field(ge=0, le=MAX_SECONDS)
    tz_offset: int = Field(default=0, ge=-MAX_OFFSET, le=MAX_OFFSET)


class SummaryOut(Schema):
    """What the done screen shows: day N, topics, minutes. The whole
    retention loop, and it is free to compute."""

    streak: int
    topics: int
    minutes: int


class RecordedOut(SummaryOut):
    """The run POST's answer, which is the summary plus the row's id.

    Its own schema rather than an id on `SummaryOut`, because the header
    pill reads that one on every page and has no run to name. The id is
    here so the browser can attach the report to the round it just
    finished, on its own call.
    """

    id: int


class DayOut(Schema):
    date: str
    count: int
    frozen: bool


class RecentOut(Schema):
    id: int
    topic_text: str
    genre_slug: str
    at: str
    has_report: bool = False


class PointOut(Schema):
    at: str
    stall: float
    gap: float
    fillers: float | None = None
    silence: float = 0.0
    restarts: float = 0.0


class MinuteOut(Schema):
    at: str
    seconds: int
    segments: list


class RoundOut(Schema):
    """One round as the skills a learner is building. Null where a round
    could not be measured on a skill, never nought."""

    id: int
    at: str
    genre_slug: str
    prep_seconds: int
    setting: int
    spoken: int
    stall: float
    silence: float
    gaps: int
    restarts: int
    timed: bool
    ended: bool | None = None
    ums: int | None = None
    distinct: int | None = None
    leaned: dict[str, int] = {}
    answered: str | None = None
    point_at: float | None = None


class FirstOut(Schema):
    at: str
    run_id: int


class ProgressOut(Schema):
    """Whether somebody is getting better. Absent until there are enough
    rounds to mean anything, which is stated as a number of rounds still
    needed rather than drawn as a line through two points."""

    enough: bool
    needed: int
    counted: int
    points: list[PointOut] = []
    first: MinuteOut | None = None
    latest: MinuteOut | None = None
    # Every round in the window, oldest first, so the page can compare the
    # first with the last, name a skill to work on and group by genre.
    rounds: list[RoundOut] = []
    # The first round that met each milestone, or null while none has.
    firsts: dict[str, FirstOut | None] = {}



class HistoryOut(Schema):
    """The streak page's whole answer: the numbers, a calendar as long as
    the plan tracks, the newest runs up to the plan's cap, and the caps
    themselves so the page can say which window it is drawing."""

    streak: int
    longest: int
    topics: int
    minutes: int
    would_be: int
    days: int
    runs_kept: int
    calendar: list[DayOut]
    recent: list[RecentOut]
    # The signed-in owner's share token, so the streak page can show the
    # link or offer to make one; null for a stranger and before it is made.
    share_token: str | None = None
    # Rides on the same answer as the calendar, so the page cannot draw a
    # trend that disagrees with the streak beside it.
    progress: ProgressOut


class ShareOut(Schema):
    token: str


class SharedTopicOut(Schema):
    text: str
    slug: str


class SharedOut(Schema):
    """One person's practice as a stranger may see it: the first name they
    gave or nothing, never the email; the numbers; eight weeks; and only
    the bank topics they practised, each a link into a round on it."""

    name: str
    streak: int
    topics: int
    minutes: int
    days: int
    calendar: list[DayOut]
    recent: list[SharedTopicOut]


class PauseOut(Schema):
    at: float
    seconds: float
    awkward: bool


class CrutchOut(Schema):
    word: str
    count: int


class SaidOut(Schema):
    kind: str
    text: str
    seconds: float = 0.0
    awkward: bool = False
    at: float = 0.0


class PaceOut(Schema):
    start: float
    end: float
    wpm: int


class FillerAtOut(Schema):
    word: str
    at: float


class RestartOut(Schema):
    quote: str
    at: float


class RepeatOut(Schema):
    phrase: str
    count: int


class SentenceOut(Schema):
    """One sentence, what it was doing and when it was said. The role is
    the model's and is empty on a round nothing read; the span is
    arithmetic over the word clock and null where no clock came back."""

    text: str
    words: int
    role: str = ""
    at: float | None = None
    end: float | None = None


class CaseOut(Schema):
    """What the topic asked for, and whether it was given. The only prose
    in this report, and it is two capped sentences: a verdict of what
    happened and one thing to do next time. The word is one of yes, half
    or no; the page draws it, never a score."""

    answered: str
    verdict: str
    advice: str


class UsualOut(Schema):
    """What this person usually does, as the mean of the rounds before
    this one. Any part can be absent: a pace needs rounds with words, a
    filler rate needs rounds a filler-keeping transcriber saw."""

    pace: int | None = None
    stall: float | None = None
    gap: float | None = None
    fillers: float | None = None
    sentence: int | None = None
    rounds: int


class ReportOut(Schema):
    """What the done screen draws. The timing half is always here and the
    word half is null when nothing transcribed the round, so a page can
    tell a smaller report from a report full of zeroes and say so.

    Pauses are recomputed from the stored segments rather than read off a
    column, so moving `analysis.AWKWARD_PAUSE` changes what history says
    it was rather than only what the next round says."""

    heard: bool
    speaking_seconds: float
    opening_stall: float
    pauses: list[PauseOut]
    longest_pause: float
    awkward_pauses: int
    speaking_ratio: float
    trail_off: float

    words: int | None = None
    pace: int | None = None
    fillers: int | None = None
    filler_rate: float | None = None
    crutch_words: list[CrutchOut] = []
    filler_words: list[str] = []
    fillers_at_transitions: int | None = None
    transcript: str = ""
    said: list[SaidOut] = []
    topic: str = ""
    at: str = ""
    genre_slug: str = ""

    # The round's own page, all of it arithmetic over the transcript and
    # the word timings. Empty lists where nothing timed the words; the
    # filler pieces are empty again wherever a filler count would not be
    # honest, for the same reason `fillers` is null there.
    pace_curve: list[PaceOut] = []
    filler_times: list[FillerAtOut] = []
    filler_counts: list[CrutchOut] = []
    leaned_on: list[CrutchOut] = []
    restarts: list[RestartOut] = []
    repeats: list[RepeatOut] = []
    sentences: list[SentenceOut] = []
    ended_clean: bool = False
    # Null for free and for anybody with fewer than two rounds behind them.
    usual: UsualOut | None = None
    # What the topic asked for, and whether it was given. Null on every
    # round nothing read: free rounds, rounds from before the feature, and
    # any call that came back in a shape we do not take.
    case: CaseOut | None = None

    # Seconds of transcription left this calendar month, so the page can
    # say what is left rather than let somebody discover it by finishing a
    # round and getting a smaller report than the last one.
    seconds_left: int = 0
