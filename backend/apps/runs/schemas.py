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
