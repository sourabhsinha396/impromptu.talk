"""The built-in bank: the ten genres, the warm-ups, the styles and the files.

The topics themselves are one JSON file per genre under `data/topics/`,
carried over from v0 unchanged. Editing a file and running `seed_topics`
is the whole content workflow.
"""

import json
from pathlib import Path

from django.utils.text import slugify

TOPICS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "topics"

#: (slug, name, icon, blurb), in the order the picker shows them. Ten and no
#: more: a flat scroll list stops working somewhere around fifteen, which is
#: why ten needs no shelves.
GENRES: tuple[tuple[str, str, str, str], ...] = (
    ("general", "General", "dices", "Ordinary things, meals, journeys. A bit of everything - start here."),
    ("relationships", "Relationships", "heart", "Friends, family, love, and the awkward bits."),
    ("career", "Career & work", "briefcase", "Work, ambition, focus, and the questions interviewers ask."),
    ("money-business", "Money & business", "banknote", "Money, building things, and selling them."),
    ("tech-ai", "Tech & AI", "bot", "Machines, models, and what they are doing to us."),
    ("science", "Science & climate", "microscope", "How the world works, and the arguments about the planet."),
    ("health", "Health & mind", "dumbbell", "Bodies, attention, rest, and why people do what they do."),
    (
        "philosophy",
        "Philosophy & ethics",
        "brain",
        "Big questions with no right answer, and hard choices with no clean side.",
    ),
    ("culture", "Culture", "clapperboard", "History, screens, and the hypotheticals you have argued at 2am."),
    (
        "deep-research",
        "Deep research",
        "graduation-cap",
        "Quantum, economics, machine learning. Hard ideas said out loud, and the one genre worth a long prep.",
    ),
)

#: How a genre is practised. `speak` is every genre above: a prompt you are
#: asked to talk about. `read` is a warm-up: text you read aloud off a
#: scroller, which skips prep (there is nothing to think about) and has no
#: clock (the scroll is the timer). One column and one branch, not a second
#: round (docs/DECISIONS.md).
MODE_SPEAK = "speak"
MODE_READ = "read"

#: The warm-ups, kept out of GENRES on purpose: the ten are a flat unheaded
#: list in the picker and the decision behind ten is not reopened by adding
#: to it. These sit in their own labelled group, the way Yours already does.
WARM_UPS: tuple[tuple[str, str, str, str], ...] = (
    (
        "tongue-twisters",
        "Tongue twisters",
        "mic",
        "Long ones, read aloud off a scroller. Warm up your mouth before you talk.",
    ),
)


def all_genres() -> tuple[tuple[str, str, str, str, str], ...]:
    """Every built-in genre with its mode, in picker order: the ten, then
    the warm-ups. The seeder and the API both walk this rather than GENRES,
    so a warm-up cannot be half-declared."""
    return tuple((*genre, MODE_SPEAK) for genre in GENRES) + tuple((*genre, MODE_READ) for genre in WARM_UPS)


#: (key, label, hint): how you are asked to talk about a topic. Surprise me is
#: first because it is the default, and it is not a style: it means no
#: filter, and it is never stored on a topic. The other four are four modes
#: (open, argue, teach, tell), and that is the test a fifth has to pass.
STYLES: tuple[tuple[str, str, str], ...] = (
    ("surprise", "Surprise me", "Any style. The default."),
    ("just-talk", "Just talk", "An open prompt. Go wherever it takes you."),
    ("hot-take", "Hot take", "Pick a side in the first ten seconds."),
    ("explain", "Explain it simply", "Teach it to someone who has never heard of it."),
    ("story", "Tell a story", "One moment, one scene, one point."),
)

SURPRISE = "surprise"

#: The styles a built-in topic may carry.
STYLE_KEYS: frozenset[str] = frozenset(key for key, *_ in STYLES if key != SURPRISE)

MAX_TEXT = 200
MAX_IMAGE = 500

#: A passage is a paragraph, not a prompt: 100 to 120 words, which is 40 to
#: 60 seconds of reading aloud at the speeds the scroller offers. The
#: ceiling is a guard against a runaway file, not a target.
MAX_PASSAGE = 1200
MIN_PASSAGE = 200

#: What a read topic carries in `style`. Difficulty is the only axis a
#: passage has - you do not choose how to talk about words you read
#: verbatim - so it rides in the column that already exists rather than
#: earning one of its own. Easy first, because the page leads with it.
READ_STYLES: tuple[tuple[str, str], ...] = (("easy", "Easy"), ("hard", "Hard"))
READ_STYLE_KEYS: frozenset[str] = frozenset(key for key, _ in READ_STYLES)


def slugify_topic(text: str) -> str:
    return slugify(text)[:220]


def load(slug: str, mode: str = MODE_SPEAK) -> list[dict] | None:
    """The topics in a genre's file, checked, or None when there is no file.

    A missing file is skipped rather than fatal, so a genre can be declared
    before its bank is written. A bad line is fatal: a topic that silently
    lands with no style, or none at all, is far harder to notice than an
    import error.

    The mode decides what "checked" means, and the length bound is the
    reason this takes one at all. A prompt is a sentence and a passage is a
    paragraph, and the 200-character ceiling that keeps prompts short would
    have silently truncated every passage mid-sentence had they shared it.
    """
    path = TOPICS_DIR / f"{slug}.json"
    if not path.exists():
        return None
    read = mode == MODE_READ
    low, high = (MIN_PASSAGE, MAX_PASSAGE) if read else (1, MAX_TEXT)
    allowed = READ_STYLE_KEYS if read else STYLE_KEYS
    payload = json.loads(path.read_text(encoding="utf-8"))
    topics = []
    for item in payload["topics"]:
        text = item["text"].strip()
        style = item.get("style", item.get("format", "just-talk"))
        if not low <= len(text) <= high:
            raise ValueError(f"{path.name}: text must be {low} to {high} characters, got {len(text)}: {text[:60]!r}")
        if style not in allowed:
            raise ValueError(f"{path.name}: unknown style {style!r} on {text[:60]!r}")
        # A picture as well as a sentence: `image` on the row is what makes
        # it a picture topic (docs/DECISIONS.md, 2026-09-09). The key is not
        # required, so every file written before this one still loads.
        image = item.get("image", "").strip()
        if len(image) > MAX_IMAGE:
            raise ValueError(f"{path.name}: overlong image on {text[:60]!r}")
        # A passage slugifies to 220 characters of its first sentence, which
        # is no use in a link somebody is meant to paste. Read files name
        # their own; speak files never have and do not start now.
        named = str(item.get("slug", "")).strip()
        if named and not read:
            raise ValueError(f"{path.name}: only a read genre names its own slugs")
        topics.append({"text": text, "style": style, "image": image, "slug": named or slugify_topic(text)})
    return topics
