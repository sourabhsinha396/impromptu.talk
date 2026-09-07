"""What a minute of speaking was like, computed and never judged.

Two signals arrive from a round and they are not equal. The browser
measures **time** with voice activity detection on the raw audio envelope:
when sound started, every gap and how long each one lasted. That is exact,
costs nothing and works in every browser, because it is arithmetic on
loudness rather than a guess about language. A transcription service
supplies **words**, and only that can say how many times somebody said
"um". So timing is the floor everybody gets and words are the layer that
costs money, which is the whole shape of the free and paid split.

Nothing here calls a model and nothing here writes prose. Every number
below is reproducible from the same input, which is what lets a person
argue with it and lets a trend be drawn through it. A paragraph of advice
from a model cannot be plotted, so a report made of paragraphs would mean
no progress view could ever exist.

Two deliberate refusals, both of them things the market sells:

- **No confidence score.** Confidence lives in pitch and volume. No audio
  is stored, and a number derived from a transcript alone would be a
  guess wearing a decimal point.
- **No weak words.** A fixed list calling "chocolate" weak is a lookup
  dressed as insight. What is real is a word *you* lean on, which is why
  discourse markers are counted as `crutch_words` and reported with their
  own name rather than as a fault.

Only non-lexical fillers ("um", "uh") are counted as fillers. "Like" and
"basically" are real words doing real work; they are leaned on, not wrong,
and they are counted separately.

Filler *clustering*, which says whether the ums bunch at the transitions
rather than spreading evenly, needs word-level timestamps. Plain text
cannot place a word in the minute, so it is absent here rather than
approximated, and lands with the provider that returns word timings.
"""

import re
from dataclasses import dataclass

# Below this a silence is articulation, not a pause: the stop inside "t"
# and the join between two words both read as quiet to an envelope, and
# counting them would report forty pauses in a fluent minute.
MIN_PAUSE = 0.3

# Above this a listener notices the gap. Conversation research puts the
# point where silence starts to feel like a hole at around a second; a
# minute of deliberate speech is more forgiving, so the line sits a little
# past it. Tunable, and the one number here most worth revisiting against
# real recordings.
AWKWARD_PAUSE = 1.5

# The last fifth of the clock, which is where an impromptu minute decays
# when somebody has run out of thought before they have run out of time.
TAIL = 0.2

# Sound below this fraction of the round is a dead or muted microphone,
# not a quiet speaker. A report drawn from it would say somebody paused
# for a minute, which is the worst possible first impression, so the
# caller is told nothing was heard instead.
HEARD_FLOOR = 0.05

# Non-lexical fillers only. These are not words; they are the sound of
# thinking out loud, and they are the one thing a person can hear
# themselves doing the moment it is pointed at.
FILLERS = frozenset({"um", "uh", "erm", "er", "ah", "mm", "hmm", "uhh", "umm"})

# Words that are doing real work and are still worth counting when they
# arrive forty times in a minute. Reported as "words you lean on", never
# as a mistake, because that is what they are.
CRUTCHES = frozenset(
    {
        "like",
        "basically",
        "actually",
        "literally",
        "obviously",
        "honestly",
        "essentially",
        "just",
        "really",
        "so",
        "well",
        "right",
        "okay",
        "yeah",
    }
)

# How many leaned-on words a report names. Three is what fits a line and
# what a person can act on; a ranked list of fifteen is a spreadsheet.
CRUTCHES_NAMED = 3

_WORD = re.compile(r"[a-z']+")


@dataclass(frozen=True)
class Pause:
    """One silence: where it fell in the minute and how long it held."""

    at: float
    seconds: float
    awkward: bool


@dataclass(frozen=True)
class Timing:
    """Everything the browser can prove on its own. No service, no cost,
    no language: this is arithmetic on when sound was present."""

    heard: bool
    speaking_seconds: float
    # Silence before the first word. The signature failure of impromptu
    # speaking is the throat-clear, and this is the one number that names
    # it. Nobody else in this market measures it.
    opening_stall: float
    pauses: tuple[Pause, ...]
    longest_pause: float
    awkward_pauses: int
    # Share of the round that carried sound, so a minute that was half
    # silence reads as one.
    speaking_ratio: float
    # Sound in the final fifth against the rest. One is steady, below one
    # is a fade. Above one is a sprint to the finish, which is also worth
    # seeing.
    trail_off: float


@dataclass(frozen=True)
class Words:
    """What only a transcript can say. Absent when nothing transcribed the
    round, which is a smaller report and never a broken one."""

    count: int
    # Words a minute over *speaking* time rather than wall time: pace is
    # how fast the words came out, and the silence between them is already
    # reported as pauses. Measuring over wall time would count one long
    # pause twice.
    pace: int
    fillers: int
    filler_rate: float
    crutch_words: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class Report:
    timing: Timing
    words: Words | None


def _clean(segments: list[tuple[float, float]], length: float) -> list[tuple[float, float]]:
    """The browser is not trusted with its own arithmetic. Segments arrive
    over the wire, so they are clipped to the round, dropped when empty,
    sorted, and merged where they touch: an overlap left in place would
    make speaking time exceed the minute it happened in."""
    clipped = []
    for start, end in segments:
        start = max(0.0, min(float(start), length))
        end = max(0.0, min(float(end), length))
        if end > start:
            clipped.append((start, end))
    if not clipped:
        return []
    clipped.sort()
    merged = [clipped[0]]
    for start, end in clipped[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _density(segments: list[tuple[float, float]], start: float, end: float) -> float:
    """Share of a window that carried sound."""
    if end <= start:
        return 0.0
    inside = sum(max(0.0, min(e, end) - max(s, start)) for s, e in segments)
    return inside / (end - start)


def timing(segments: list[tuple[float, float]], length: float) -> Timing:
    """The floor of every report, free and paid alike."""
    empty = Timing(
        heard=False,
        speaking_seconds=0.0,
        opening_stall=0.0,
        pauses=(),
        longest_pause=0.0,
        awkward_pauses=0,
        speaking_ratio=0.0,
        trail_off=0.0,
    )
    length = float(length)
    if length <= 0:
        return empty

    spoken = _clean(segments, length)
    speaking_seconds = sum(end - start for start, end in spoken)
    ratio = speaking_seconds / length
    if not spoken or ratio < HEARD_FLOOR:
        return empty

    # Only the gaps *between* words count. The silence after the last word
    # is somebody having finished, which is a short answer and not a pause,
    # and reporting it would punish stopping early. Finishing early is
    # data, not a failure.
    pauses = []
    # strict=False on purpose: pairing a list with its own tail is one
    # short by design, which is what walks the gaps between segments.
    for (_, end), (start, _) in zip(spoken, spoken[1:], strict=False):
        gap = start - end
        if gap >= MIN_PAUSE:
            pauses.append(Pause(at=round(end, 2), seconds=round(gap, 2), awkward=gap >= AWKWARD_PAUSE))

    tail_from = length * (1 - TAIL)
    body = _density(spoken, 0.0, tail_from)
    tail = _density(spoken, tail_from, length)

    return Timing(
        heard=True,
        speaking_seconds=round(speaking_seconds, 2),
        opening_stall=round(spoken[0][0], 2),
        pauses=tuple(pauses),
        longest_pause=round(max((p.seconds for p in pauses), default=0.0), 2),
        awkward_pauses=sum(1 for p in pauses if p.awkward),
        speaking_ratio=round(ratio, 3),
        # A body of pure silence cannot be divided into, and a tail against
        # nothing is not a fade; steady is the honest answer there.
        trail_off=round(tail / body, 2) if body else 1.0,
    )


def words(transcript: str, speaking_seconds: float) -> Words | None:
    """None when nothing transcribed the round, so a caller can tell a
    smaller report from a report full of zeroes."""
    if not transcript or not transcript.strip():
        return None

    tokens = _WORD.findall(transcript.lower())
    fillers = sum(1 for token in tokens if token in FILLERS)
    # Fillers are not words anybody said on purpose, so they are counted
    # and then left out of the count and the pace. A minute of "um" is not
    # a fast minute.
    spoken_words = [token for token in tokens if token not in FILLERS]

    counts: dict[str, int] = {}
    for token in spoken_words:
        if token in CRUTCHES:
            counts[token] = counts.get(token, 0) + 1
    # Alphabetical inside a tie, so the same round always names the same
    # three words and a trend never wobbles on dictionary order.
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))

    minutes = speaking_seconds / 60 if speaking_seconds > 0 else 0.0
    return Words(
        count=len(spoken_words),
        pace=round(len(spoken_words) / minutes) if minutes else 0,
        fillers=fillers,
        filler_rate=round(fillers / minutes, 1) if minutes else 0.0,
        crutch_words=tuple(ranked[:CRUTCHES_NAMED]),
    )


def report(segments: list[tuple[float, float]], length: float, transcript: str = "") -> Report:
    """One call for both tiers. The provider that produced the transcript,
    and whether there is one at all, is the only thing that differs; the
    numbers are computed the same way either way, so free and paid can
    never drift into meaning different things by the same name."""
    measured = timing(segments, length)
    if not measured.heard:
        return Report(timing=measured, words=None)
    return Report(timing=measured, words=words(transcript, measured.speaking_seconds))
