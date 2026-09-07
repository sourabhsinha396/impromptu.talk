"""Rows for tests, one factory per model, sequenced so two calls never
collide. A test that needs a specific value passes it; everything else is
whatever the sequence hands out."""

import datetime as dt

import factory
from factory.django import DjangoModelFactory

from apps.authentication.models import User
from apps.payments.models import Purchase
from apps.runs.models import Run
from apps.topics.models import Genre, Topic

PASSWORD = "correct horse battery"
DEVICE = "0123456789abcdef0123456789abcdef"


def midday() -> dt.datetime:
    """Noon today in UTC, the instant runs are dated back from. `now()` is
    how a suite passes all afternoon and fails at 3am: with now at 04:00 a
    run "five hours ago" lands on the previous calendar day. Noon is twelve
    hours from either boundary. The date is still today's, because the
    streak and the cohorts read the real clock for day zero."""
    return dt.datetime.now(dt.UTC).replace(hour=12, minute=0, second=0, microsecond=0)


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"speaker{n}@example.com")
    name = ""

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        # `password=""` asks for the unusable password a Google-only row
        # has: factory_boy cannot tell `password=None` from an argument
        # nobody passed, so blank is the way to say it. A test that wants
        # a particular one passes it, and the rest get the shared one.
        obj.set_password(PASSWORD if extracted is None else (extracted or None))
        if create:
            obj.save()


class GenreFactory(DjangoModelFactory):
    class Meta:
        model = Genre

    slug = factory.Sequence(lambda n: f"genre-{n}")
    name = factory.Sequence(lambda n: f"Genre {n}")
    icon = "sparkles"


class TopicFactory(DjangoModelFactory):
    class Meta:
        model = Topic

    genre = factory.SubFactory(GenreFactory)
    text = factory.Sequence(lambda n: f"Topic {n}")
    slug = factory.LazyAttribute(lambda t: t.text.lower().replace(" ", "-"))
    style = "just-talk"


class RunFactory(DjangoModelFactory):
    """One finished round. `days_ago` is the one number most streak tests
    care about, so it is the parameter; the rest is whatever a round is."""

    class Meta:
        model = Run
        exclude = ("days_ago", "hours_ago", "base")

    days_ago = 0
    hours_ago = 0
    base = factory.LazyFunction(midday)

    device_id = DEVICE
    user = None
    topic_text = "Low tide"
    genre_slug = "general"
    prep_seconds = 60
    speak_seconds = 60
    spoken_seconds = 60
    tz_offset = 0
    created_at = factory.LazyAttribute(lambda r: r.base - dt.timedelta(days=r.days_ago, hours=r.hours_ago))


def runs_on_days(days: list[int], **fields) -> None:
    """A run on each of `days` (0 today, 1 yesterday), one base for the
    whole list so the rows stay exactly a day apart."""
    base = midday()
    for day in days:
        RunFactory(days_ago=day, base=base, **fields)


class PurchaseFactory(DjangoModelFactory):
    """One settled purchase. Paid and forever by default, because that is
    the row every entitlement test starts from; `days` is how long the
    access it bought lasts, and None means never running out."""

    class Meta:
        model = Purchase
        exclude = ("days",)

    days = None

    user = factory.SubFactory(UserFactory)
    reference = factory.Sequence(lambda n: f"ref{n:08d}")
    plan = "lifetime"
    status = Purchase.PAID
    session_id = factory.Sequence(lambda n: f"sess_{n}")
    amount_minor = 3900
    currency = "USD"
    usd_cents = 3900
    expires_at = factory.LazyAttribute(
        lambda p: None if p.days is None else dt.datetime.now(dt.UTC) + dt.timedelta(days=p.days)
    )


def all_factories():
    return [UserFactory, GenreFactory, TopicFactory, RunFactory, PurchaseFactory]
