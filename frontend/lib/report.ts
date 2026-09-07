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
  transcript: string;
  seconds_left: number;
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
