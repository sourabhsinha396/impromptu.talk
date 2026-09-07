/* The report on a round, as the done screen reads it.

   Its own call, after the run. The run POST answers instantly with day N
   and the streak, because that is the retention loop; transcribing takes
   seconds, so the report arrives afterwards and fills itself in. A
   transcriber having a slow day costs somebody their report and never
   their streak.

   The arithmetic that turns a report into something drawable lives here
   with no DOM in it, the way `practice.ts` turns dates into a grid, so it
   is a table of tests rather than a page nobody can check. */

import type { Heard } from "@/lib/round/voice";

export type Pause = { at: number; seconds: number; awkward: boolean };
export type Crutch = { word: string; count: number };
export type PaceAt = { start: number; end: number; wpm: number };
export type FillerAt = { word: string; at: number };
export type Restart = { quote: string; at: number };
export type Repeat = { phrase: string; count: number };
/* What a sentence was doing, from `apps/runs/argument.py`. Empty on
   every round nothing read, which is every free round and every round
   from before a model read them. */
export type Role = "" | "point" | "reason" | "example" | "setup" | "aside" | "close";
/* One sentence, what it was doing and when it was said. The span is
   arithmetic over the word clock and is null where no clock came back. */
export type Sentence = { text: string; words: number; role: Role; at: number | null; end: number | null };
/* What the topic asked for, and whether it was given. Two capped
   sentences and one word, never a score and never a rewrite. */
export type Case = { answered: "yes" | "half" | "no"; verdict: string; advice: string };
/* What this person usually does, the mean of the rounds before this one.
   Pro's, and absent under two rounds; any part can be null on its own. */
export type Usual = {
  pace: number | null;
  stall: number | null;
  gap: number | null;
  fillers: number | null;
  sentence: number | null;
  rounds: number;
};

export type Report = {
  heard: boolean;
  speaking_seconds: number;
  opening_stall: number;
  pauses: Pause[];
  longest_pause: number;
  awkward_pauses: number;
  speaking_ratio: number;
  trail_off: number;
  /* Null rather than zero when nothing transcribed the round: nobody said
     no words, and a page has to tell those apart. The filler count is null
     again whenever the transcript came from Whisper, which deletes them
     before anybody asks. */
  words: number | null;
  pace: number | null;
  fillers: number | null;
  filler_rate: number | null;
  crutch_words: Crutch[];
  filler_words: string[];
  /* Fillers that landed beside a silence. A different problem from saying
     um a lot, and a different fix. Null where nothing could count them. */
  fillers_at_transitions: number | null;
  transcript: string;
  /* The transcript with our own silences put back where they fell, when
     the transcriber returned word timings. Empty otherwise, and the plain
     transcript is shown instead. */
  said: Said[];
  topic: string;
  at: string;
  genre_slug: string;
  seconds_left: number;
  /* The round's own page. All arithmetic over the transcript and the word
     timings; empty where nothing timed the words, and the filler pieces
     empty again wherever a filler count would not be honest. */
  pace_curve: PaceAt[];
  filler_times: FillerAt[];
  filler_counts: Crutch[];
  leaned_on: Crutch[];
  restarts: Restart[];
  repeats: Repeat[];
  sentences: Sentence[];
  ended_clean: boolean;
  usual: Usual | null;
  /* Null on every round nothing read: free rounds, rounds from before the
     feature, and any call that came back in a shape we do not take. */
  case: Case | null;
};

/** Sends the timeline and the recording. Fails quietly: the round already
    happened and a missing report is not the speaker's problem. */
export async function attach(runId: number, heard: Heard): Promise<Report | null> {
  const body = new FormData();
  body.append("segments", JSON.stringify(heard.segments));
  if (heard.audio && heard.audio.size) body.append("audio", heard.audio, heard.filename);
  try {
    const response = await fetch(`/api/v1/runs/${runId}/report`, { method: "POST", body });
    return response.ok ? ((await response.json()) as Report) : null;
  } catch {
    return null;
  }
}

/* Four kinds and not two booleans, because the fourth is the one that
   kept being drawn wrong: silence after the last word is having finished,
   which is data and not a failure, and painting it like a gap told
   somebody who answered in twenty seconds that they had left a
   forty-second hole. */
export type Kind = "talking" | "breath" | "gap" | "after";
export type Block = { at: number; width: number; kind: Kind; seconds: number };

/** A pause long enough to read as a hole rather than a breath. Matches the
    backend's own threshold; both are a guess at where a listener notices,
    and the number will move once there are real recordings to move it
    against. */
export const AWKWARD = 1.5;

/** The minute as a row of blocks: talking, then the gaps between, laid out
    left to right as fractions of the whole round.

    One bar is the most convincing thing in the whole report. You see the
    six-second hole at 0:34 and the cluster before it without reading a
    number, which is why this is the first thing on the done screen and why
    it has no text on it at all. */
export function blocks(report: Report, length: number): Block[] {
  if (!report.heard || length <= 0) return [];
  const out: Block[] = [];
  let at = 0;

  const push = (from: number, to: number, kind: Kind) => {
    const seconds = to - from;
    if (seconds <= 0) return;
    out.push({
      at: (from / length) * 100,
      width: (seconds / length) * 100,
      kind: kind === "breath" && seconds >= AWKWARD ? "gap" : kind,
      seconds: Math.round(seconds * 10) / 10,
    });
  };

  // Rebuilt from the pauses rather than the segments, because the pauses
  // are what the backend returns and what carries the awkward flag. The
  // opening stall is the first gap and is deliberately drawn like any
  // other, since it is the same thing: silence where words could be.
  let cursor = report.opening_stall;
  push(0, cursor, "breath");
  for (const pause of report.pauses) {
    push(cursor, pause.at, "talking");
    push(pause.at, pause.at + pause.seconds, "breath");
    cursor = pause.at + pause.seconds;
  }
  const spokeUntil = Math.min(length, lastSound(report, length));
  push(cursor, spokeUntil, "talking");
  at = spokeUntil;
  if (at < length) push(at, length, "after");
  return out;
}

export type Mark =
  | { kind: "stroke"; x: number; height: number }
  | { kind: "line"; from: number; to: number; tone: "breath" | "gap"; seconds: number };

/** How far apart the strokes sit, as a share of the width. One in a
    hundred is six pixels on a laptop and three on a phone, which is the
    narrowest that still reads as strokes rather than a block. */
export const PITCH = 1;

/* A quiet rise and fall, so a stretch of talking looks like a voice and
   not like a comb. A texture and not a measurement: no audio is kept and
   nothing here knows how loud anybody was, only when there was sound. */
const HEIGHTS = [0.55, 0.9, 0.7, 1, 0.6, 0.85, 0.75, 0.95];

/** The minute as a waveform: strokes where there was a voice, a flat line
    where there was not, the long holes in the warm colour.

    The first bar was a strip of green and red, and reading it took a
    key: which colour was the talking, and was red bad. A wave needs no
    key, because everybody has seen one: the wiggle is a voice and the
    flat line is nobody speaking (owner's call, with a sketch). The
    silence after the last word draws nothing at all, since finishing
    early is not a hole. */
export function waveform(parts: Block[], pitch: number = PITCH): Mark[] {
  const out: Mark[] = [];
  let index = 0;
  for (const block of parts) {
    if (block.kind === "talking") {
      const end = block.at + block.width;
      // A stretch narrower than the pitch still gets one stroke, in the
      // middle of it: a word said is a word drawn.
      let x = block.width < pitch ? block.at + block.width / 2 : block.at + pitch / 2;
      for (; x < end; x += pitch) {
        // The first and last strokes of a stretch are shorter, so a
        // voice starts and stops rather than switching on and off.
        const edge = x - block.at < pitch || end - x < pitch;
        out.push({ kind: "stroke", x, height: HEIGHTS[index % HEIGHTS.length] * (edge ? 0.5 : 1) });
        index += 1;
      }
    } else if (block.kind === "breath" || block.kind === "gap") {
      out.push({ kind: "line", from: block.at, to: block.at + block.width, tone: block.kind, seconds: block.seconds });
    }
  }
  return out;
}

/** Where the voice stopped for good. Speaking time plus every gap before
    it, which lands on the end of the last stretch of sound. */
function lastSound(report: Report, length: number): number {
  const gaps = report.pauses.reduce((total, pause) => total + pause.seconds, 0);
  return Math.min(length, report.opening_stall + gaps + report.speaking_seconds);
}

/** Seconds as `0:07`, for the numbers under the bar. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The one line under the bar, chosen from whichever number is furthest
    from where it should be.

    One sentence and never a paragraph. The report never rewrites anybody's
    words: prose from a model cannot be plotted, so a report made of it
    would mean the progress view could never exist, and "you could have
    phrased this as" is not something anybody can act on tomorrow. */
export function headline(report: Report): string {
  if (!report.heard) return "We could not hear you. Check your microphone.";
  if (report.opening_stall >= 3) return `You took ${clock(report.opening_stall)} to start. Open with your point.`;
  if (report.longest_pause >= 3) return `Your longest gap was ${report.longest_pause} seconds.`;
  if (report.trail_off < 0.6) return "You faded at the end. Plan your last line early.";
  if (report.fillers !== null && report.filler_rate !== null && report.filler_rate >= 4) {
    return `You said um ${report.fillers} times. Pause instead.`;
  }
  if (report.awkward_pauses > 0) {
    const many = report.awkward_pauses > 1;
    return `${report.awkward_pauses} gap${many ? "s" : ""} long enough to notice.`;
  }
  return "Steady all the way through.";
}


export type Said = {
  kind: "word" | "filler" | "crutch" | "pause";
  text: string;
  seconds: number;
  awkward: boolean;
  /* Where it fell, so the read-back can find the word a restart began on. */
  at: number;
};

export type Marked = { text: string; kind: "filler" | "crutch" | "" };

/** The transcript split so the page can mark what was counted.

    Reading your own minute back is the most convincing thing in the
    report after the bar, and it is the one artifact we already store and
    have never shown. Marking is done against the words the backend says
    it found, rather than a copy of its lists kept here, for the same
    reason the country ladder lives in one place: two copies of the same
    table drift apart on the first edit. */
export function marked(report: Report): Marked[] {
  const text = report.transcript.trim();
  if (!text) return [];
  const fillers = new Set(report.filler_words.map((word) => word.toLowerCase()));
  const crutches = new Set(report.crutch_words.map((crutch) => crutch.word.toLowerCase()));
  // Split on word boundaries and keep the gaps, so punctuation and spacing
  // survive: a transcript reflowed into single spaces stops reading like
  // the thing somebody said.
  return text.split(/([A-Za-z']+)/).flatMap<Marked>((part) => {
    if (!part) return [];
    const word = part.toLowerCase();
    if (fillers.has(word)) return [{ text: part, kind: "filler" }];
    if (crutches.has(word)) return [{ text: part, kind: "crutch" }];
    return [{ text: part, kind: "" }];
  });
}

/* ------------------------------------------------------------- the bands */

/* Where a number sits against a comfortable range, which is what makes it
   mean anything on a first round.

   "166 wpm" is a fact about physics. "166 wpm, and comfortable is 130 to
   170" is a fact about you, and it needs no history at all, which is the
   whole point: the baseline from your own past rounds is Pro's, and this
   is what free gets on the very first minute.

   **These edges are editorial and they are meant to move.** Speaking pace
   is the only one with much behind it: ordinary clear speech and most
   recorded talks sit around 130 to 170 words a minute, so that is the
   band. The rest are judgement, set where a listener starts to notice,
   and they should be revisited against real rounds rather than defended.
   Nothing here is presented as a score, and no round is ever called
   wrong; the words are "rushed" and "slow", never "bad". */

export type Band = {
  key: string;
  label: string;
  value: number;
  /** What is written on the marker. */
  shown: string;
  /** The whole scale drawn, low to high. */
  scale: [number, number];
  /** The comfortable stretch inside it. */
  good: [number, number];
  /** One word for where they landed. */
  verdict: string;
  /** The ends of the scale, named, so the picture reads without a legend. */
  ends: [string, string];
  /** The one-word name the radar has room for. */
  short?: string;
  /** Where this person usually lands, drawn as a hollow ring; null without a past. */
  usual?: number | null;
  /** An axis of the shape and never a bar: the donut says it better. */
  radarOnly?: boolean;
};

function band(
  key: string,
  label: string,
  value: number,
  shown: string,
  scale: [number, number],
  good: [number, number],
  words: [string, string, string],
  ends: [string, string],
): Band {
  const verdict = value < good[0] ? words[0] : value > good[1] ? words[2] : words[1];
  return { key, label, value, shown, scale, good, verdict, ends };
}

function paceBand(report: Report): Band | null {
  if (report.pace === null || report.pace <= 0) return null;
  return band(
    "pace",
    "Pace",
    report.pace,
    `${report.pace} wpm`,
    [80, 220],
    [130, 170],
    ["Slow", "Good pace", "Rushed"],
    ["slow", "rushed"],
  );
}

// Lower is better, so the comfortable stretch starts at nothing and the
// scale runs out to the right.
function startBand(report: Report): Band {
  return band(
    "start",
    "Time to start",
    report.opening_stall,
    clock(report.opening_stall),
    [0, 8],
    [0, 2],
    ["", "Straight in", "Slow to start"],
    ["at once", "8s"],
  );
}

// The comfortable edge is AWKWARD itself, and deliberately so. It was
// 2 while a pause became "long enough to notice" at 1.5, so a round with
// a 1.6-second gap had a headline calling it out and a band underneath
// calling it fine. A report that contradicts itself is the one thing
// that makes every other number on the page worth less.
function gapBand(report: Report): Band {
  return band(
    "gap",
    "Longest gap",
    report.longest_pause,
    `${report.longest_pause}s`,
    [0, 8],
    [0, AWKWARD],
    ["", "No holes", "Long hole"],
    ["none", "8s"],
  );
}

export function bands(report: Report): Band[] {
  const out: Band[] = [];

  const pace = paceBand(report);
  if (pace) out.push(pace);
  out.push(startBand(report));
  out.push(gapBand(report));

  if (report.filler_rate !== null) {
    out.push(
      band(
        "fillers",
        "Ums a minute",
        report.filler_rate,
        `${report.filler_rate}`,
        [0, 12],
        [0, 4],
        ["", "Clean", "Heavy"],
        ["none", "12"],
      ),
    );
  }

  return out;
}

/** Where a value falls across the scale, as a percentage, clamped so a
    wild number still draws a marker on the track instead of off it. */
export function at(value: number, [low, high]: [number, number]): number {
  if (high <= low) return 0;
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}

/* ---------------------------------------------------------- the progress */

export type Point = {
  at: string;
  stall: number;
  gap: number;
  fillers: number | null;
  silence: number;
  restarts: number;
};
export type Minute = { at: string; seconds: number; segments: number[][] };
/* One round as the skills a learner is building. Null where a round could
   not be measured on a skill, never nought: a round nothing transcribed
   has no ending to judge and no words to count. */
export type Round = {
  id: number;
  at: string;
  genre_slug: string;
  prep_seconds: number;
  setting: number;
  spoken: number;
  stall: number;
  silence: number;
  gaps: number;
  restarts: number;
  timed: boolean;
  ended: boolean | null;
  ums: number | null;
  distinct: number | null;
  leaned: Record<string, number>;
  /* Whether the topic was answered, and the second the point landed. Both
     null on every round nothing read, which is not the same as a round
     that answered nothing. */
  answered: "yes" | "half" | "no" | null;
  point_at: number | null;
};
export type First = { at: string; run_id: number };
export type Progress = {
  enough: boolean;
  needed: number;
  counted: number;
  points: Point[];
  first: Minute | null;
  latest: Minute | null;
  rounds: Round[];
  firsts: Record<string, First | null>;
};

/** The same bar the done screen draws, from raw segments rather than a
    whole report, so the first minute and the latest can be put one above
    the other at the same scale. Nothing here needs a transcript. */
export function minuteBlocks(segments: number[][], length: number): Block[] {
  if (!segments.length || length <= 0) return [];
  const out: Block[] = [];
  const push = (from: number, to: number, kind: Kind) => {
    const seconds = to - from;
    if (seconds <= 0) return;
    out.push({
      at: (from / length) * 100,
      width: (seconds / length) * 100,
      kind: kind === "breath" && seconds >= AWKWARD ? "gap" : kind,
      seconds: Math.round(seconds * 10) / 10,
    });
  };
  /* Nothing is drawn past the end of the round, whatever the timeline
     says. A stored timeline can overrun its own round - a leaked ticker
     measured one 58 second round out to 226 seconds before `voice.ts`
     was fixed, and those rows are still here - and the silence before a
     segment was the one edge that was not clipped, so a round like that
     painted a red line clean across the page and out of the column.
     Caught on the live streak page. A picture of one minute cannot show
     what happened after it. */
  let cursor = 0;
  for (const [start, end] of segments) {
    if (cursor >= length) break;
    const from = Math.min(start, length);
    push(cursor, from, "breath");
    push(from, Math.min(end, length), "talking");
    cursor = Math.min(end, length);
  }
  // Whatever is left is having finished, not a hole.
  if (cursor < length) push(cursor, length, "after");
  return out;
}

/** How a metric moved between the first reading and the last. Negative is
    better for all three: less stalling, shorter gaps, fewer ums. */
export function movement(points: Point[], pick: (p: Point) => number | null): { from: number; to: number } | null {
  const seen = points.map(pick).filter((v): v is number => v !== null);
  if (seen.length < 2) return null;
  return { from: seen[0], to: seen[seen.length - 1] };
}


/* One thing to do about a band that is outside its comfortable stretch.

   Behind a disclosure rather than on the face of it, because the verdict
   is one word and the done screen is a moment, not a lecture. Written
   here and not by a model: the same round has to give the same advice
   twice, and a sentence that varies between two readings of one minute is
   not advice, it is weather. */
export function advice(band: Band): string | null {
  const low = band.value < band.good[0];
  const high = band.value > band.good[1];
  if (!low && !high) return null;
  switch (band.key) {
    case "pace":
      return low
        ? "Push on a little. Long words land better than long gaps."
        : "Slow down. Land on your full stops and let them sit.";
    case "start":
      return "Open with your claim, not a wind-up. Say the point, then explain it.";
    case "gap":
      return "Say the next point half-formed. A wobble costs less than a hole.";
    case "fillers":
      return "Pause instead of um. Silence reads as deliberate; um reads as lost.";
    case "sentence":
      return "Land a full stop. Then start the next thought fresh.";
    default:
      return null;
  }
}

/* -------------------------------------------------- the round's own page */

/** A sentence this long has run on. Impromptu speech fails by stringing
    thoughts on "and" more than by any other route, and no count of pauses
    shows it; one column of 56 words does. Editorial, like every edge here. */
export const RUN_ON = 35;

/** The five things the round's own page measures it on, each against its
    comfortable stretch. One list feeds the radar and the bars so the two
    can never disagree. Fillers are an axis of the shape and never a bar,
    because the donut beside it says everything a bar would, as words rather
    than as a rate (owner's call). */
export function axes(report: Report): Band[] {
  const usual = report.usual;
  const out: Band[] = [];
  const pace = paceBand(report);
  if (pace) out.push({ ...pace, short: "Pace", usual: usual?.pace ?? null });
  out.push({ ...startBand(report), short: "Start", usual: usual?.stall ?? null });
  out.push({ ...gapBand(report), short: "Gaps", usual: usual?.gap ?? null });
  const longest = Math.max(0, ...report.sentences.map((sentence) => sentence.words));
  if (longest > 0) {
    out.push({
      ...band(
        "sentence",
        "Longest sentence",
        longest,
        `${longest} words`,
        [0, 60],
        [0, RUN_ON],
        ["", "Landed", "Run-on"],
        ["short", "60 words"],
      ),
      short: "Sentences",
      usual: usual?.sentence ?? null,
    });
  }
  if (report.filler_rate !== null) {
    out.push({
      ...band("fillers", "Fillers", report.filler_rate, `${report.filler_rate}`, [0, 12], [0, 4], ["", "Clean", "Heavy"], ["none", "12"]),
      short: "Fillers",
      usual: usual?.fillers ?? null,
      radarOnly: true,
    });
  }
  return out;
}

/** How far inside the comfortable stretch, as the radar draws it: 100
    anywhere inside, falling to nothing at the end of the scale. A shape
    and never a score with a name: an average of seconds and words a minute
    would be a number with nothing behind it. */
export function fit(band: Band, value: number | null = band.value): number | null {
  if (value === null || value === undefined) return null;
  if (value >= band.good[0] && value <= band.good[1]) return 100;
  const room = value > band.good[1] ? band.scale[1] - band.good[1] : band.good[0] - band.scale[0];
  if (room <= 0) return 0;
  const over = value > band.good[1] ? (value - band.good[1]) / room : (band.good[0] - value) / room;
  return Math.max(0, Math.round(100 * (1 - over)));
}

/** The line beside the shape: how many landed, and which is furthest out. */
export function shapeCaption(rows: Band[]): string {
  if (!rows.length) return "";
  const inRange = rows.filter((row) => fit(row) === 100).length;
  if (inRange === rows.length) return `All ${rows.length} in the comfortable range`;
  const worst = [...rows].sort((a, b) => (fit(a) ?? 0) - (fit(b) ?? 0))[0];
  return `${inRange} of ${rows.length} in the comfortable range · furthest out: ${worst.label.toLowerCase()}`;
}

/** Written by code from the peak and the trough, never by a model, so the
    same round reads the same twice. Nothing under two readings. */
export function paceCaption(report: Report): string | null {
  const points = report.pace_curve;
  if (points.length < 2) return null;
  const fast = points.reduce((best, point) => (point.wpm > best.wpm ? point : best));
  const slow = points.reduce((best, point) => (point.wpm < best.wpm ? point : best));
  let out = `Fastest from ${clock(fast.start)}, ${fast.wpm} words a minute. Slowest from ${clock(slow.start)}, ${slow.wpm}.`;
  if (report.trail_off < 0.6) out += " You faded in the last stretch.";
  else if (report.trail_off > 1.4) out += " You sped up to finish.";
  return out;
}

export type Slice = { word: string; count: number; kind: "filler" | "crutch"; shade: number };

/** The donut's slices: fillers first and warm, leaned-on words after and
    in the accent, each group stepping down in shade so a legend can tell
    them apart. Everything else you said is the quiet remainder. */
export function slices(report: Report): Slice[] {
  const fillers = report.filler_counts.map<Slice>((c, i) => ({
    word: c.word,
    count: c.count,
    kind: "filler",
    shade: Math.max(0.4, 1 - i * 0.3),
  }));
  const crutches = report.leaned_on.map<Slice>((c, i) => ({
    word: c.word,
    count: c.count,
    kind: "crutch",
    shade: Math.max(0.35, 1 - i * 0.16),
  }));
  return [...fillers, ...crutches];
}

/** Every word said, fillers included, which is what the donut is a share
    of. A Whisper round has no fillers to include, honestly or otherwise. */
export function saidCount(report: Report): number {
  return (report.words ?? 0) + (report.fillers ?? 0);
}

/** How many different words, fillers left out. Sixty different words in a
    hundred and twenty-five is a fact about range that nothing else here
    carries. */
export function distinctWords(report: Report): number {
  const fillers = new Set(report.filler_words.map((word) => word.toLowerCase()));
  const seen = new Set<string>();
  for (const word of report.transcript.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (!fillers.has(word)) seen.add(word);
  }
  return seen.size;
}

export function sentenceCaption(report: Report): string | null {
  const counts = report.sentences.map((sentence) => sentence.words);
  if (!counts.length) return null;
  const longest = Math.max(...counts);
  return longest > RUN_ON
    ? `One ran to ${longest} words. Land a full stop and let it sit.`
    : `Longest ${longest} words. Every one of them landed.`;
}

/** Where the voice stopped for good, for the tile beside the first word. */
export function lastWord(report: Report, length: number): number {
  const gaps = report.pauses.reduce((total, pause) => total + pause.seconds, 0);
  return Math.min(length, report.opening_stall + gaps + report.speaking_seconds);
}
