"""The glyphs a genre may wear, by lucide's own slug.

A fixed set rather than free text, because the value is rendered on a
page and the one thing it must never be is whatever was posted. The
frontend draws the same 26 from `components/site/icons.tsx`; a slug here
that it cannot draw is a genre with no mark, so the two lists are the
same length on purpose and each side pins its own.
"""

ICONS: tuple[str, ...] = (
    "sparkles",
    "dices",
    "coffee",
    "briefcase",
    "graduation-cap",
    "notebook-pen",
    "mic",
    "bot",
    "microscope",
    "banknote",
    "rocket",
    "scale",
    "brain",
    "heart",
    "utensils",
    "plane",
    "globe",
    "dumbbell",
    "sprout",
    "scroll",
    "clapperboard",
    "music",
    "trophy",
    "palette",
    "paw-print",
    "flame",
)

DEFAULT_ICON = ICONS[0]


def valid_icon(value: str | None) -> str:
    """One we offer, or the default. Unrecognised is the default rather
    than an error, the same posture as every other thing a person picks."""
    return value if value in ICONS else DEFAULT_ICON
