from ninja import Field, Schema

from apps.topics import bank
from apps.topics.generate import MAX_PROMPT
from apps.topics.owned import MAX_STYLE


class GenreOut(Schema):
    """`mode` says how the genre is practised: `speak` for the ten, `read`
    for a warm-up whose topics are passages read off a scroller. Absent on
    a speak genre rather than repeated on every row, for the reason
    `TopicOut.image` gives."""

    slug: str
    name: str
    icon: str
    blurb: str
    mode: str | None = None


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
    repeated key costs nothing there.

    `topics` carries the speak genres only. A read genre's passages are
    100 to 120 words each and are fetched when it is picked, because the
    instant-spin promise is about the reel - a respin must cost no round
    trip - and somebody who has just chosen to read a passage aloud for a
    minute will not notice one. Shipping them inline would have put 45KB
    of raw JSON on every home visit for a genre most visitors never open,
    which is the same trade the picture key lost (docs/DECISIONS.md)."""

    genres: list[GenreOut]
    topics: list[TopicOut]
    styles: list[StyleOut]


class PassageOut(Schema):
    """One passage, and the count the page states before it starts: words
    are what the speed is in, so the reading time is arithmetic the browser
    can do rather than a number to store."""

    text: str
    slug: str
    style: str
    words: int


class ReadGenreOut(Schema):
    slug: str
    name: str
    icon: str
    blurb: str
    passages: list[PassageOut]


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
    #: "read" on a warm-up, absent otherwise, the way the bank does it.
    mode: str | None = None
    #: The cap this genre is held to. It differs by mode: a passage is a
    #: hundred words, so fifty of them is already a long page.
    max_topics: int = 0


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
    max_passages: int = 0
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
    """`mode` says which round this genre runs: `speak` for prompts you
    talk about, `read` for passages you read aloud off a scroller. Absent
    means speak, so anything written before warm-ups existed still creates
    what it meant to."""

    name: str = Field(max_length=60)
    icon: str = ""
    mode: str | None = None


class PasteIn(Schema):
    """A whole paste in one field, and the style an untagged line gets.
    Sized for the larger of the two caps: 200 prompts of 200 characters,
    or 50 passages of 1200, with room for the tails and the newlines."""

    text: str = Field(max_length=60000)
    default_style: str = ""


class TopicIn(Schema):
    """`text` is bounded here at the longest a *passage* may be, not the
    longest a prompt may be. The edge cannot know which kind of genre this
    row belongs to; `owned.edit_topic` can, and enforces the tighter rule
    where it does. Bounded at 200 here, editing a passage was refused at
    the edge with a bare 422 that named nothing."""

    text: str = Field(max_length=bank.MAX_PASSAGE)
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
