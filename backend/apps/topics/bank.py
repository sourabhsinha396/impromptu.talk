"""The built-in bank: the ten genres, the four styles, and the files.

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
    ("general", "General", "dices", "A bit of everything. Start here."),
    ("everyday-life", "Everyday life", "coffee", "Ordinary things, meals, journeys - hard to fake, easy to start."),
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
)

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


def slugify_topic(text: str) -> str:
    return slugify(text)[:220]


def load(slug: str) -> list[dict] | None:
    """The topics in a genre's file, checked, or None when there is no file.

    A missing file is skipped rather than fatal, so a genre can be declared
    before its bank is written. A bad line is fatal: a topic that silently
    lands with no style, or none at all, is far harder to notice than an
    import error.
    """
    path = TOPICS_DIR / f"{slug}.json"
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    topics = []
    for item in payload["topics"]:
        text = item["text"].strip()
        style = item.get("style", item.get("format", "just-talk"))
        if not text or len(text) > MAX_TEXT:
            raise ValueError(f"{path.name}: blank or overlong topic {text!r}")
        if style not in STYLE_KEYS:
            raise ValueError(f"{path.name}: unknown style {style!r} on {text!r}")
        topics.append({"text": text, "style": style})
    return topics
