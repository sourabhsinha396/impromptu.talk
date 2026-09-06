"""Rows for tests, one factory per model, sequenced so two calls never
collide. A test that needs a specific value passes it; everything else is
whatever the sequence hands out."""

import factory
from factory.django import DjangoModelFactory

from apps.authentication.models import User
from apps.topics.models import Genre, Topic

PASSWORD = "correct horse battery"


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"speaker{n}@example.com")
    name = ""

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        # None keeps the unusable password a Google-only row has; a test that
        # wants one passes it, and the rest get the shared one.
        obj.set_password(PASSWORD if extracted is None else extracted)
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


def all_factories():
    return [UserFactory, GenreFactory, TopicFactory]
