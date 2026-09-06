from ninja import Schema


class GenreOut(Schema):
    slug: str
    name: str
    icon: str
    blurb: str


class TopicOut(Schema):
    text: str
    genre: str
    style: str
    slug: str


class StyleOut(Schema):
    key: str
    label: str
    hint: str


class BankOut(Schema):
    """One shape for the picker, the reel and the style select. Full key
    names rather than v0's one-letter ones: the page ships gzipped, and a
    repeated key costs nothing there."""

    genres: list[GenreOut]
    topics: list[TopicOut]
    styles: list[StyleOut]
