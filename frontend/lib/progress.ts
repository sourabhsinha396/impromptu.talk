/* Progress, read the way somebody trying to get better reads it.

   They want three things: proof they got better at what scared them, one
   thing to work on next, and to know that a bad day is not a relapse. So
   this compares the first rounds with the last, names the skill furthest
   from comfortable, and shows the floor rising. Every function here is
   arithmetic over the rounds the backend already sends, with no DOM in it,
   so it is a table of tests rather than a page nobody can check. */

import { AWKWARD, clock, type Round } from "@/lib/report";

/** Then-and-now and the floor need this many rounds: three against three
    is the least that says anything about a person rather than a day. */
export const SIX = 6;
/** How many rounds each side of then-and-now is, at most. */
export const COMPARE_MOST = 5;
/** How many recent rounds "work on next" reads. */
export const RECENT = 5;
/** The lines draw a dot per round up to this many; past it the line
    carries it alone. */
export const DOTS_UNTIL = 12;

/* The good edges. The stall and the gap are the round page's; the
   rest are editorial, like every edge in the report, and are meant to
   move against real rounds. Silence is seconds of a round with no voice
   in them, so fifteen is a quarter of a minute quiet. */
export const GOOD_SILENCE = 15;
export const GOOD_STALL = 2;
export const GOOD_RESTARTS = 0.5;
export const GOOD_FILLED = 55;
export const GOOD_HABIT = 3;
export const GOOD_RANGE = 80;

export type SkillKey = "silence" | "stall" | "restarts" | "spoken" | "ended" | "habit" | "distinct";

export type Skill = {
  key: SkillKey;
  label: string;
  /** Higher is better. The default is lower. */
  up?: boolean;
  /** A share of rounds that managed it, not a mean. */
  rate?: boolean;
  good?: [number, number];
  scale?: [number, number];
  /** What "work on next" calls it, and what to do. A skill without these
      is never the one named: there is nothing to tell somebody to do
      about their vocabulary range. */
  name?: string;
  advice?: string;
  fmt: (value: number) => string;
  say: (then: number, now: number, of: number, word: string) => string;
};

const r1 = (value: number) => Math.round(value * 10) / 10;

export const SKILLS: Skill[] = [
  {
    key: "silence",
    label: "Silence",
    good: [0, GOOD_SILENCE],
    scale: [0, 40],
    name: "keeping going",
    advice: "Start your next point even if it is not ready. A long silence is worse than a small mistake.",
    fmt: (v) => `${Math.round(v)}s`,
    say: (a, b) => `You are quiet for ${Math.round(b)} seconds of your minute. It was ${Math.round(a)}.`,
  },
  {
    key: "stall",
    label: "Time to start",
    good: [0, GOOD_STALL],
    scale: [0, 8],
    name: "starting quickly",
    advice: "Say your point first. Then explain it.",
    fmt: (v) => `${r1(v)}s`,
    say: (a, b) => `You start after ${r1(b)} seconds. It was ${r1(a)}.`,
  },
  {
    key: "restarts",
    label: "Restarts",
    good: [0, GOOD_RESTARTS],
    scale: [0, 4],
    name: "finishing your sentences",
    advice: "If you lose a sentence, finish it anyway. Nobody heard the sentence you planned.",
    fmt: (v) => `${r1(v)} a round`,
    say: (a, b) => `You go back for a sentence ${r1(b)} times a round. It was ${r1(a)}.`,
  },
  {
    key: "spoken",
    label: "Filling the time",
    up: true,
    good: [GOOD_FILLED, 60],
    scale: [30, 60],
    name: "filling the time",
    advice: "Plan your last sentence while you think, then keep talking until the time ends.",
    fmt: (v) => clock(v),
    say: (a, b) => `You speak until ${clock(b)} of 1:00. It was ${clock(a)}.`,
  },
  {
    key: "ended",
    label: "A clean ending",
    rate: true,
    fmt: (v) => `${v}`,
    say: (a, b, of) => `You end on a full stop in ${b} of ${of} rounds. It was ${a} of ${of}.`,
  },
  {
    key: "habit",
    label: "Your word",
    good: [0, GOOD_HABIT],
    scale: [0, 12],
    name: "a habit word",
    advice: "Take a short pause where the word would go. A pause sounds calm.",
    fmt: (v) => `${r1(v)} a round`,
    say: (a, b, _of, word) => `You say "${word}" ${r1(b)} times a round. It was ${r1(a)}.`,
  },
  {
    key: "distinct",
    label: "Different words",
    up: true,
    good: [GOOD_RANGE, 140],
    scale: [40, 140],
    fmt: (v) => `${Math.round(v)}`,
    say: (a, b) => `You use ${Math.round(b)} different words in a minute. It was ${Math.round(a)}.`,
  },
];

/** A round's value on a skill, or null where the round could not be
    measured on it. A nought here always means nought. */
export function value(round: Round, skill: Skill, word: string | null): number | null {
  switch (skill.key) {
    case "silence":
      return round.silence;
    case "stall":
      return round.stall;
    case "restarts":
      return round.timed ? round.restarts : null;
    case "spoken":
      // As a share of a minute, so a two-minute setting compares with a
      // one-minute one: the skill is using the time you set.
      return round.setting > 0 ? (round.spoken / round.setting) * 60 : null;
    case "ended":
      return round.ended === null ? null : round.ended ? 1 : 0;
    case "habit":
      if (round.distinct === null || !word) return null;
      return round.leaned[word] ?? 0;
    case "distinct":
      return round.distinct;
  }
}

function measured(rounds: Round[], skill: Skill, word: string | null): number[] {
  return rounds.map((round) => value(round, skill, word)).filter((v): v is number => v !== null);
}

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** The word you lean on most across the window, which is the one worth
    tracking. Null with nothing counted. */
export function habitWord(rounds: Round[]): string | null {
  const totals: Record<string, number> = {};
  for (const round of rounds) for (const [word, count] of Object.entries(round.leaned)) totals[word] = (totals[word] ?? 0) + count;
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length ? ranked[0][0] : null;
}

export function inside(skill: Skill, v: number): boolean {
  return !skill.good || (v >= skill.good[0] && v <= skill.good[1]);
}

/** How far inside the comfortable stretch, 100 anywhere inside and
    falling to nothing at the end of the scale. */
export function fitOf(skill: Skill, v: number): number {
  if (!skill.good || !skill.scale || inside(skill, v)) return 100;
  const room = v > skill.good[1] ? skill.scale[1] - skill.good[1] : skill.good[0] - skill.scale[0];
  if (room <= 0) return 0;
  const over = v > skill.good[1] ? (v - skill.good[1]) / room : (skill.good[0] - v) / room;
  return Math.max(0, Math.round(100 * (1 - over)));
}

export type Compared = { skill: Skill; then: number; now: number; of: number; inside: boolean; sentence: string };

/** Your first rounds against your last, one row per skill that both sides
    could be measured on. Null under six rounds, which is the least that
    says something about a person rather than a day. */
export function thenAndNow(rounds: Round[]): { k: number; word: string | null; rows: Compared[] } | null {
  if (rounds.length < SIX) return null;
  const k = Math.min(COMPARE_MOST, Math.floor(rounds.length / 2));
  const first = rounds.slice(0, k);
  const last = rounds.slice(-k);
  const word = habitWord(rounds);
  const rows: Compared[] = [];
  for (const skill of SKILLS) {
    const a = measured(first, skill, word);
    const b = measured(last, skill, word);
    if (!a.length || !b.length) continue;
    const then = skill.rate ? a.reduce((s, v) => s + v, 0) : mean(a);
    const now = skill.rate ? b.reduce((s, v) => s + v, 0) : mean(b);
    const of = skill.rate ? Math.min(a.length, b.length) : k;
    rows.push({ skill, then, now, of, inside: inside(skill, now), sentence: skill.say(then, now, of, word ?? "") });
  }
  return { k, word, rows };
}

export type WorkOn =
  | { none: true; looked: number }
  | { none: false; skill: Skill; mean: number; out: number; looked: number; worst: Round; word: string | null };

/** The skill furthest from comfortable over the last few rounds, with the
    round that shows it worst. Only skills with something to do about
    them are candidates. */
export function workOn(rounds: Round[]): WorkOn | null {
  if (!rounds.length) return null;
  const recent = rounds.slice(-RECENT);
  const word = habitWord(rounds);
  let pick: { skill: Skill; mean: number; fit: number } | null = null;
  for (const skill of SKILLS) {
    if (!skill.advice || !skill.good) continue;
    const values = measured(recent, skill, word);
    if (!values.length) continue;
    const m = mean(values);
    const fit = fitOf(skill, m);
    if (!pick || fit < pick.fit) pick = { skill, mean: m, fit };
  }
  if (!pick || pick.fit === 100) return { none: true, looked: recent.length };
  const { skill } = pick;
  const measurable = recent.filter((round) => value(round, skill, word) !== null);
  const worst = measurable.reduce((a, b) => {
    const va = value(a, skill, word) ?? 0;
    const vb = value(b, skill, word) ?? 0;
    return (skill.up ? vb < va : vb > va) ? b : a;
  });
  const out = measurable.filter((round) => !inside(skill, value(round, skill, word) ?? 0)).length;
  return { none: false, skill, mean: pick.mean, out, looked: measurable.length, worst, word };
}

export type Floor = { worstNow: number; avgThen: number; k: number; beats: boolean };

/** Your quietest recent round against your first rounds' average. Getting
    better at this is mostly the bad days getting less bad, and this is
    true weeks before the average moves. */
export function floor(rounds: Round[]): Floor | null {
  if (rounds.length < SIX) return null;
  const k = Math.min(7, Math.floor(rounds.length / 2));
  const worstNow = Math.max(...rounds.slice(-k).map((round) => round.silence));
  const avgThen = mean(rounds.slice(0, k).map((round) => round.silence));
  return { worstNow, avgThen, k, beats: worstNow < avgThen };
}

export type GenreRow = { slug: string; rounds: number; silence: number; stall: number };

/** Rounds, silence and time to start by genre, the hardest first. Null
    with fewer than two genres, since one genre is not a comparison. */
export function byGenre(rounds: Round[]): GenreRow[] | null {
  const groups: Record<string, Round[]> = {};
  for (const round of rounds) (groups[round.genre_slug] ??= []).push(round);
  const slugs = Object.keys(groups);
  if (slugs.length < 2) return null;
  return slugs
    .map((slug) => ({
      slug,
      rounds: groups[slug].length,
      silence: mean(groups[slug].map((round) => round.silence)),
      stall: mean(groups[slug].map((round) => round.stall)),
    }))
    .sort((a, b) => b.silence - a.silence || a.slug.localeCompare(b.slug));
}

/** How you start with no time to think against how you start with some.
    Null until both have happened. */
export function byPrep(rounds: Round[]): { none: number; some: number } | null {
  const none = rounds.filter((round) => round.prep_seconds === 0);
  const some = rounds.filter((round) => round.prep_seconds > 0);
  if (!none.length || !some.length) return null;
  return { none: mean(none.map((round) => round.stall)), some: mean(some.map((round) => round.stall)) };
}

/** The milestones, in the order they are listed. */
export const FIRSTS: [string, string][] = [
  ["no_holes", "A minute with no long pauses"],
  ["no_restarts", "A round with no restarts"],
  ["clean_ending", "A clean ending"],
  ["full_minute", "A full minute"],
  ["quick_start", `Starting inside ${GOOD_STALL} seconds`],
  ["no_ums", "A minute with no ums"],
];

/** The three lines over the window, and the edge each is good under.
    Lower is better on all three, so "better" is always down. */
export const LINES = [
  { key: "silence" as const, label: "Silence in the minute", unit: "s", good: GOOD_SILENCE, floor: 40 },
  { key: "restarts" as const, label: "Restarts a round", unit: "", good: GOOD_RESTARTS, floor: 3 },
  { key: "stall" as const, label: "Time to start", unit: "s", good: GOOD_STALL, floor: 6 },
];

/** A gap long enough to notice, for the wave's warm line: the same edge
    as everywhere else. */
export const HOLE = AWKWARD;
