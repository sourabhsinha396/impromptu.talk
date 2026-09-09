from ninja import Field, Schema

from apps.topics.generate import MAX_PROMPT
from apps.topics.owned import MAX_STYLE


class GenreOut(Schema):
    slug: str
    name: str
    icon: str
    blurb: str


class TopicOut(Schema):
    """`image` is absent on a topic that has none rather than an empty
    string on all thousand of them: home ships the whole bank inline, and
    a key repeated across every row for the sake of the few that use it
    is 34KB of JSON the browser parses on every visit."""

    text: str
    genre: str
    style: str
    slug: str
    image: str | None = None


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


class OwnedTopicOut(Schema):
    """A topic in a genre somebody owns. The id is here and nowhere else
    in this app: a bank topic is addressed by its text, and one of these
    is edited and deleted by hand, which needs a name that survives the
    text being rewritten."""

    id: int
    text: str
    style: str
    style_label: str
    #: Ready for an `img` tag, or empty. The row holds a storage key and
    #: the route resolves it, so the CDN's name lives in settings only.
    image: str = ""


class OwnedGenreOut(Schema):
    """One genre somebody owns, topics included.

    One shape for the list, the editor and the picker rather than three.
    The topics ride along because home ships the whole bank inline so
    that another topic costs no round trip, and these are part of that
    bank; the caps are what keep that payload bounded.
    """

    slug: str
    name: str
    icon: str
    topic_count: int
    share_token: str | None
    topics: list[OwnedTopicOut]
    own_styles: list[str]
    #: Whether this genre holds an uploaded picture, which is what makes
    #: it unshareable (docs/DECISIONS.md, 2026-09-09).
    has_pictures: bool = False


class MineOut(Schema):
    """Every genre this account owns, with the caps beside them so the
    page can say "3 of 10" without holding a second copy of the rule.

    `generations_left` is zero both when the allowance is spent and when
    there is no model key at all, so a page can ask one question;
    `can_generate` is what says which of the two it is.
    """

    genres: list[OwnedGenreOut]
    max_genres: int
    max_topics: int
    can_generate: bool
    generations_left: int


class SharedGenreOut(Schema):
    """A shared genre as a stranger sees it. The owner's name if they
    gave one, never their address, and no ids: nothing on this page is
    editable, and an id here would only be an invitation to try."""

    name: str
    icon: str
    owner_name: str
    token: str
    topics: list[OwnedTopicOut]


class GenreIn(Schema):
    name: str = Field(max_length=60)
    icon: str = ""


class PasteIn(Schema):
    """A whole paste in one field, and the style an untagged line gets.
    Sized for the cap: 200 topics of 200 characters, with room for the
    tails and the newlines."""

    text: str = Field(max_length=60000)
    default_style: str = ""


class TopicIn(Schema):
    text: str = Field(max_length=200)
    style: str = Field(default="", max_length=MAX_STYLE)


class ShareOut(Schema):
    token: str | None


class GenerateIn(Schema):
    prompt: str = Field(max_length=MAX_PROMPT)


class GeneratedOut(Schema):
    """The genre as it now stands, how many lines landed, and what is left
    of the allowance, so the page never has to ask a second time."""

    genre: OwnedGenreOut
    added: int
    generations_left: int
