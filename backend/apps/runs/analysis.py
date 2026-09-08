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
#
# Mirrored as HEARD_RATIO in frontend/lib/round/voice.ts, which is what
# warns during the round rather than after it. One number in two places,
# and they have to move together: while they disagreed, a round passed the
# live check and was still thrown away here, so somebody spoke a whole
# minute, saw no warning, and read "we could not hear you" at the end.
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
    # Words a minute by the clock, from the first sound to the last. An
    # earlier version divided by speaking time with the silences taken out,
    # which is articulation rate and sits around 200 to 240 for ordinary
    # speech, and then judged it against 130 to 170, the wall-clock norm,
    # so nearly every round read as rushed. A number is measured the way it
    # is judged. The silence after the last word is still left out: a short
    # answer is not a slow one.
    pace: int
    fillers: int
    filler_rate: float
    crutch_words: tuple[tuple[str, int], ...]
    # Which fillers turned up, so a page can mark them in the transcript
    # without keeping a second copy of FILLERS in another language. The
    # same argument that kept the country ladder in one place.
    filler_words: tuple[str, ...]


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


def clock_seconds(measured: Timing) -> float:
    """From the first sound to the last: the speaking and the silences
    between, and not the silence after. What pace is measured over."""
    return measured.speaking_seconds + sum(pause.seconds for pause in measured.pauses)


def words(transcript: str, speaking_seconds: float, clock: float | None = None) -> Words | None:
    """None when nothing transcribed the round, so a caller can tell a
    smaller report from a report full of zeroes.

    `clock` is what pace is measured over, first sound to last; without one
    the speaking time stands in, which is what a caller with only a
    transcript and a duration has. The filler rate stays per speaking
    minute, since that is the column a year of trend is drawn through."""
    if not transcript or not transcript.strip():
        return None

    tokens = _WORD.findall(transcript.lower())
    # A transcript can be non-empty and still hold nothing anybody said:
    # Groq answers a tone with ". . .". That is no more a round of nought
    # words a minute than an empty one is, so it reports nothing.
    if not tokens:
        return None
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
    paced_over = (clock if clock and clock > 0 else speaking_seconds) / 60
    return Words(
        filler_words=tuple(sorted({token for token in tokens if token in FILLERS})),
        count=len(spoken_words),
        pace=round(len(spoken_words) / paced_over) if paced_over > 0 else 0,
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
    return Report(timing=measured, words=words(transcript, measured.speaking_seconds, clock_seconds(measured)))


@dataclass(frozen=True)
class Said:
    """One thing in the read-back: a word, or the silence before it."""

    kind: str
    text: str
    seconds: float = 0.0
    awkward: bool = False
    # Where it fell, so a page can find the word a restart began on.
    at: float = 0.0


# A filler this close to a silence is a transition filler: the sound of
# looking for the next point rather than a verbal tic inside one. The two
# have different fixes, which is why the count alone was never enough.
BESIDE_A_PAUSE = 1.5


def read_back(words: list[tuple[str, float, float]], pauses: tuple[Pause, ...]) -> tuple[Said, ...]:
    """The transcript with the silences put back where they fell.

    The best idea in this whole market and it costs nothing: a six-second
    hole reported as "longest gap 6s" is a number, and the same hole drawn
    inside the sentence it interrupted tells you *where* you stalled. The
    words and their clock come from the transcriber; the pauses come from
    the browser's own envelope, which is the more exact of the two, so the
    silence drawn here is ours and only its position is theirs.
    """
    if not words:
        return ()
    out: list[Said] = []
    left = list(pauses)
    previous_end = 0.0
    for text, start, end in words:
        # Every silence that closed before this word began belongs in front
        # of it. More than one can, when a word is missing from the timing.
        while left and left[0].at < start and left[0].at >= previous_end - 0.01:
            gap = left.pop(0)
            out.append(Said(kind="pause", text="", seconds=gap.seconds, awkward=gap.awkward, at=gap.at))
        while left and left[0].at < start:
            left.pop(0)
        word = text.strip()
        bare = _WORD.findall(word.lower())
        first = bare[0] if bare else ""
        kind = "filler" if first in FILLERS else "crutch" if first in CRUTCHES else "word"
        out.append(Said(kind=kind, text=word, seconds=round(end - start, 2), at=round(start, 2)))
        previous_end = end
    return tuple(out)


def at_transitions(words: list[tuple[str, float, float]], pauses: tuple[Pause, ...]) -> int:
    """How many of the fillers landed beside a silence.

    Six ums spread through a minute is a tic. Six ums each sitting against
    a pause means the next point was not ready, which is a different
    problem with a different fix, and no count on its own can tell them
    apart."""
    if not words or not pauses:
        return 0
    edges = [(p.at, p.at + p.seconds) for p in pauses]
    beside = 0
    for text, start, end in words:
        bare = _WORD.findall(text.lower())
        if not bare or bare[0] not in FILLERS:
            continue
        if any(start - close <= BESIDE_A_PAUSE and opens - end <= BESIDE_A_PAUSE for opens, close in edges):
            beside += 1
    return beside


# ------------------------------------------------------------ the full page
#
# Everything from here down is drawn on the page a past round opens to,
# and all of it is arithmetic over what was already stored: the transcript
# and the word timings. Nothing here is a new column and nothing here
# spends.

# The pace curve's step. Ten seconds is six readings in a minute: enough to
# show a sprint and a fade, few enough that one long word is not a spike.
PACE_STEP = 10

# A run of words begun again inside this many seconds is a restart: the
# sentence was lost and gone back for. Later than this it is a repeat,
# which is a habit rather than a stumble.
RESTART_WITHIN = 4.0

# The longest phrase looked for when counting what was said more than once.
REPEAT_LONGEST = 5

# A phrase made only of these is grammar and not a habit: "of the" comes
# back in every minute anybody speaks.
FUNCTION_WORDS = frozenset(
    {
        "a", "an", "the", "of", "and", "to", "in", "i", "it", "that", "is", "was", "my", "he", "she", "we",
        "you", "they", "with", "for", "on", "at", "be", "this", "but", "then", "so", "are", "or", "as", "if",
        "not", "do", "have", "has", "had", "there", "what", "which",
    }
)  # fmt: skip

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class PaceAt:
    start: float
    end: float
    wpm: int


def _ends_sentence(written: str) -> bool:
    return written.rstrip('"”') .endswith((".", "!", "?"))


def _timed_words(words: list[tuple[str, float, float]]) -> list[tuple[str, str, float, float]]:
    """(bare word, as written, start, end) for every timed token. The bare
    word is empty for a token that holds no letters."""
    out = []
    for text, start, end in words:
        written = str(text).strip()
        bare = _WORD.findall(written.lower())
        out.append((bare[0] if bare else "", written, float(start), float(end)))
    return out


def pace_curve(words: list[tuple[str, float, float]], length: float, step: int = PACE_STEP) -> tuple[PaceAt, ...]:
    """Words a minute in each stretch of the round, by the clock.

    One pace for the round hides the shape of it: run 30 read as a single
    235 and was 156, 120, 210, 78, 126, 75 across its six stretches, a
    sprint at 0:20 and a fade from 0:40. Fillers are left out as they are
    everywhere. Empty without word timings, since a plain transcript cannot
    place a word in the minute."""
    spoken = [start for bare, _, start, _ in _timed_words(words) if bare and bare not in FILLERS]
    if not spoken or length <= 0 or step <= 0:
        return ()
    out = []
    start = 0.0
    while start < length:
        end = min(float(length), start + step)
        inside = sum(1 for at in spoken if start <= at < end)
        out.append(PaceAt(start=round(start, 2), end=round(end, 2), wpm=round(inside * 60 / (end - start))))
        start = end
    return tuple(out)


@dataclass(frozen=True)
class FillerAt:
    word: str
    at: float


def filler_times(words: list[tuple[str, float, float]]) -> tuple[FillerAt, ...]:
    """Where each filler fell, so six ums can be drawn as six marks under
    the minute rather than read as a count."""
    return tuple(
        FillerAt(word=bare, at=round(start, 2)) for bare, _, start, _ in _timed_words(words) if bare in FILLERS
    )


def _ranked(counts: dict[str, int]) -> tuple[tuple[str, int], ...]:
    return tuple(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])))


def _counted(transcript: str, among: frozenset[str]) -> tuple[tuple[str, int], ...]:
    counts: dict[str, int] = {}
    for token in _WORD.findall(transcript.lower()):
        if token in among:
            counts[token] = counts.get(token, 0) + 1
    return _ranked(counts)


def filler_counts(transcript: str) -> tuple[tuple[str, int], ...]:
    """Every filler with its count, most said first."""
    return _counted(transcript, FILLERS)


def leaned_on(transcript: str) -> tuple[tuple[str, int], ...]:
    """Every leaned-on word with its count. `Words.crutch_words` names the
    top few for a line of text; the page that lists them wants them all."""
    return _counted(transcript, CRUTCHES)


@dataclass(frozen=True)
class Restart:
    quote: str
    at: float


def restarts(words: list[tuple[str, float, float]]) -> tuple[Restart, ...]:
    """Two-word runs begun twice within a few seconds, quoted from the first
    start to the second.

    "and that I used, and that I used" is the sound of losing the thread and
    going back for it, and it is the thing nobody hears in themselves. A
    filler between the two tries does not break the match, since "I said,
    uh, I said" is the commonest shape of one. One restart per stretch: the
    pairs inside a single stumble are one stumble."""
    timed = _timed_words(words)
    plain = [index for index, (bare, _, _, _) in enumerate(timed) if bare and bare not in FILLERS]
    out: list[Restart] = []
    last_at = -RESTART_WITHIN
    for position in range(len(plain) - 3):
        first = plain[position]
        pair = (timed[plain[position]][0], timed[plain[position + 1]][0])
        for later in range(position + 2, min(position + 9, len(plain) - 1)):
            # A full stop between the two tries makes it a sentence said
            # again on purpose, which is emphasis and not a stumble.
            if any(_ends_sentence(timed[index][1]) for index in range(first, plain[later])):
                break
            again = (timed[plain[later]][0], timed[plain[later + 1]][0])
            if again != pair or timed[plain[later]][2] - timed[first][2] > RESTART_WITHIN:
                continue
            if timed[first][2] - last_at > 1.0:
                quote = " ".join(timed[index][1] for index in range(first, plain[later + 1] + 1))
                out.append(Restart(quote=quote, at=round(timed[first][2], 2)))
                last_at = timed[first][2]
            break
    return tuple(out)


def repeats(transcript: str, leave: tuple[str, ...] = ()) -> tuple[tuple[str, int], ...]:
    """Phrases of two to five words said more than once, each in its
    longest form.

    "most of the time" three times is a habit worth hearing; "of the" three
    times is English, so a phrase made only of function words is never
    listed, and a two-word phrase has to come back three times and hold no
    function word to count at all. Between a phrase and a longer one that
    holds it, the longer wins when they were said the same number of
    times, and the shorter wins when it was said more. Anything inside one
    of `leave` (the restarts) belongs to the restart and is not listed
    twice."""
    # Within a sentence only: "pen. The pen" is two sentences meeting, not
    # a phrase anybody said.
    by_sentence = [
        [token for token in _WORD.findall(part.lower()) if token not in FILLERS]
        for part in _SENTENCE_END.split(transcript.strip())
    ]
    left = [" ".join(t for t in _WORD.findall(quote.lower()) if t not in FILLERS) for quote in leave]
    found: dict[str, int] = {}
    for size in range(2, REPEAT_LONGEST + 1):
        grams: dict[str, int] = {}
        for plain in by_sentence:
            for index in range(len(plain) - size + 1):
                gram = " ".join(plain[index : index + size])
                grams[gram] = grams.get(gram, 0) + 1
        for gram, count in grams.items():
            parts = gram.split()
            if count < 2 or all(part in FUNCTION_WORDS for part in parts):
                continue
            if size == 2 and (count < 3 or any(part in FUNCTION_WORDS for part in parts)):
                continue
            if any(f" {gram} " in f" {quote} " for quote in left):
                continue
            found[gram] = count
    kept = []
    for gram, count in found.items():
        inside_a_longer_one_said_as_often = any(
            gram != other and f" {gram} " in f" {other} " and n == count for other, n in found.items()
        )
        holds_a_shorter_one_said_more = any(
            gram != other and f" {other} " in f" {gram} " and n > count for other, n in found.items()
        )
        if not inside_a_longer_one_said_as_often and not holds_a_shorter_one_said_more:
            kept.append((gram, count))
    return tuple(sorted(kept, key=lambda pair: (-pair[1], -len(pair[0]), pair[0])))


@dataclass(frozen=True)
class Sentence:
    text: str
    words: int


def sentences(transcript: str) -> tuple[Sentence, ...]:
    """The transcript by its full stops, each with its word count, fillers
    left out. Impromptu speech fails by running on ("and... and... and")
    more than by any other route, and no count of pauses shows it; one
    sentence of 56 words does."""
    out = []
    for part in _SENTENCE_END.split(transcript.strip()):
        part = part.strip()
        count = sum(1 for token in _WORD.findall(part.lower()) if token not in FILLERS)
        if count:
            out.append(Sentence(text=part, words=count))
    return tuple(out)


@dataclass(frozen=True)
class Span:
    start: float
    end: float


def sentence_spans(words: list[tuple[str, float, float]], said: tuple[Sentence, ...]) -> tuple[Span | None, ...]:
    """When each sentence was spoken, off the same word clock the pauses
    and the pace already come from.

    The transcript and the word timings are one provider's answer to one
    minute, so the sentences are walked in order and words taken off the
    front until the countable ones match what the sentence holds. Counted
    the way `sentences` counts, fillers left out, or a token with no
    letters in it ("a 2 rupee penny") would leave every later sentence off
    by one and the drawing would drift down the round.

    None where the words ran out, which a page draws as nothing rather
    than as a sentence at nought seconds."""
    timed = _timed_words(words)
    out: list[Span | None] = []
    cursor = 0
    for sentence in said:
        counted = 0
        start = end = None
        while cursor < len(timed) and counted < sentence.words:
            bare, _, at, until = timed[cursor]
            if start is None:
                start = at
            end = until
            if bare and bare not in FILLERS:
                counted += 1
            cursor += 1
        found = counted == sentence.words and start is not None and end is not None
        out.append(Span(start=round(start, 2), end=round(end, 2)) if found else None)
    return tuple(out)


def distinct_words(transcript: str) -> int:
    """How many different words, fillers left out. Sixty different words
    in a hundred and twenty-five is a fact about range that nothing else
    in the report carries."""
    return len({token for token in _WORD.findall((transcript or "").lower()) if token not in FILLERS})


def ended_clean(transcript: str) -> bool:
    """Whether the last thing said was a finished sentence, as the
    transcriber punctuated it. A transcript that trails off without a full
    stop is somebody the clock cut off mid-thought. Transcribers are
    generous with a final full stop, so this errs towards yes."""
    return bool(re.search(r'[.!?]["”]?\s*$', transcript or ""))
