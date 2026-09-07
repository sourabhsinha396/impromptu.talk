/* The case somebody made, read the way a learner reads it.

   Every other measure on the round page says how a minute sounded. This
   one says whether it did what the topic asked, which is the thing a
   learner most needs to hear and the thing no count of pauses can reach.

   The backend stores a role for each sentence and one word for whether
   the topic was answered (`apps/runs/argument.py`); everything here is
   arithmetic over those and the word timings the report already carries.
   No DOM in this file, so it is a table of tests rather than a page
   nobody can check. */

import type { Case, Role, Round, Sentence } from "@/lib/report";

/* What each role is called on the page. In the order a legend reads them,
   which is the order they usually arrive in a round. */
export const ROLE_WORD: Record<Exclude<Role, "">, string> = {
  point: "the point",
  reason: "a reason",
  example: "an example",
  setup: "wind-up",
  aside: "an aside",
  close: "the close",
};

export const ANSWERED_WORD: Record<Case["answered"], string> = {
  yes: "Answered it.",
  half: "Half answered.",
  no: "Missed it.",
};

/** Reaching your point inside this is reaching it at once. Editorial, like
    every edge in this report: twelve seconds is about two sentences of
    wind-up, which is as much as a minute can afford. */
export const POINT_BY = 12;

/** How many rounds the squares show. Ten is a fortnight of practice and
    fits a phone at four pixels a square. */
export const LAST_TEN = 10;

export type CaseBlock = { at: number; width: number; role: Role; text: string; start: number };

/** Each sentence as a block on the minute, coloured by what it was doing.
    A sentence the word clock could not place is left out rather than
    drawn at nought, which is the same rule the pauses follow. */
export function caseBlocks(sentences: Sentence[], length: number): CaseBlock[] {
  if (length <= 0) return [];
  const out: CaseBlock[] = [];
  for (const sentence of sentences) {
    if (sentence.at === null || sentence.end === null) continue;
    const width = ((sentence.end - sentence.at) / length) * 100;
    if (width <= 0) continue;
    out.push({
      at: (sentence.at / length) * 100,
      width,
      role: sentence.role,
      text: sentence.text,
      start: sentence.at,
    });
  }
  return out;
}

/** Whether any sentence did what the topic asked. Separate from where it
    landed, because a round can make its point and still have no clock to
    put it on, and "no point made" would be a lie about that round. */
export function hasPoint(sentences: Sentence[]): boolean {
  return sentences.some((sentence) => sentence.role === "point");
}

/** The second the point landed, or null when none was made and null again
    when nothing timed the words. */
export function pointAt(sentences: Sentence[]): number | null {
  const point = sentences.find((sentence) => sentence.role === "point");
  return point?.at ?? null;
}

/** Only the roles this round used, in the legend's own order. Six squares
    under every round would be a lesson; three under this one is a key. */
export function rolesUsed(sentences: Sentence[]): Exclude<Role, "">[] {
  const order = Object.keys(ROLE_WORD) as Exclude<Role, "">[];
  return order.filter((role) => sentences.some((sentence) => sentence.role === role));
}

/* ------------------------------------------------------- across rounds */

/** The last rounds a model read, oldest first. A round nothing read is
    left out rather than drawn as a miss: not answering and not being
    counted are different things and the squares must not confuse them. */
export function readRounds(rounds: Round[], most: number = LAST_TEN): Round[] {
  return rounds.filter((round) => round.answered !== null).slice(-most);
}

/** How many of them answered the topic. */
export function answeredCount(rounds: Round[]): number {
  return rounds.filter((round) => round.answered === "yes").length;
}

/** The first and the latest time to the point, for the line that says
    which way it moved. Null under two rounds that made one, because one
    reading is a fact and not a direction. */
export function pointMoved(rounds: Round[]): { from: number; to: number } | null {
  const times = rounds.map((round) => round.point_at).filter((at): at is number => at !== null);
  if (times.length < 2) return null;
  return { from: times[0], to: times[times.length - 1] };
}

/* ------------------------------------------------------------ the free
   sample.

   One fixed round, the same for everybody, shown blurred where a Pro
   round would show their own. Not their own round blurred: no model ever
   read it, so there is nothing of theirs behind the blur, and a blur over
   something that does not exist reads as a fault rather than a door. */
export const SAMPLE_LENGTH = 60;

export const SAMPLE_CASE: Case = {
  answered: "yes",
  verdict: "The story you were asked for: the point in the first sentence, three reasons, then what happened.",
  advice: "Start the close ten seconds earlier, so the lesson lands before the bell.",
};

export const SAMPLE_SENTENCES: Sentence[] = [
  { text: "So, um, I got offered a promotion last year and, uh, I did not want it.", words: 14, role: "point", at: 2.8, end: 8 },
  { text: "Um, the thing is, I liked my job.", words: 7, role: "reason", at: 10.2, end: 12.6 },
  { text: "I liked, like, actually doing the work.", words: 7, role: "reason", at: 13.2, end: 15.5 },
  { text: "And the promotion was, um, basically managing people who did the work.", words: 11, role: "reason", at: 18.3, end: 21.9 },
  { text: "So I said, uh, I said I would think about it.", words: 10, role: "example", at: 23.2, end: 25.4 },
  { text: "And then I, um, I avoided my manager for like two weeks, which, yeah, was not great.", words: 16, role: "example", at: 28.7, end: 32.8 },
  { text: "Eventually I told her the truth.", words: 6, role: "example", at: 34.8, end: 35.8 },
  { text: "I said I would rather be really good at this than, um, average at that.", words: 14, role: "example", at: 36.4, end: 40.9 },
  { text: "She was fine with it, actually.", words: 6, role: "example", at: 42.7, end: 44.3 },
  { text: "Better than fine.", words: 3, role: "example", at: 45.3, end: 46.3 },
  { text: "So, yeah, I think, um, I think the lesson is you can say no and, uh, and the world", words: 17, role: "close", at: 49.7, end: 59.2 },
];

/* Ten rounds behind the sample one, so the cards under it show a person
   getting to the point sooner over a fortnight, which is what the cards
   are for. Only the two fields the cards read are real here. */
export const SAMPLE_ROUNDS: Round[] = [
  ["no", null],
  ["no", null],
  ["half", 41],
  ["no", null],
  ["yes", 14],
  ["half", 22],
  ["yes", 9],
  ["yes", 6],
  ["half", 12],
  ["yes", 3],
].map(([answered, at], index) => ({
  id: index + 1,
  at: new Date(Date.UTC(2026, 7, 29 + index, 9)).toISOString(),
  genre_slug: "general",
  prep_seconds: 60,
  setting: 60,
  spoken: 60,
  stall: 2,
  silence: 12,
  gaps: 1,
  restarts: 0,
  timed: true,
  ended: true,
  ums: 4,
  distinct: 60,
  leaned: {},
  answered: answered as Round["answered"],
  point_at: at as number | null,
}));
