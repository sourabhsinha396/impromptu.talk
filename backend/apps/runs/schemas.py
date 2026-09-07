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


class DayOut(Schema):
    date: str
    count: int
    frozen: bool


class RecentOut(Schema):
    topic_text: str
    genre_slug: str
    at: str


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
    transcript: str = ""

    # Seconds of transcription left this calendar month, so the page can
    # say what is left rather than let somebody discover it by finishing a
    # round and getting a smaller report than the last one.
    seconds_left: int = 0
