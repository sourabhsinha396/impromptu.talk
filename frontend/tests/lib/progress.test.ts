import { describe, expect, it } from "vitest";

import {
  COMPARE_MOST,
  SIX,
  byGenre,
  byPrep,
  fitOf,
  floor,
  habitWord,
  thenAndNow,
  workOn,
} from "@/lib/progress";
import type { Round } from "@/lib/report";

/* Progress is what Pro sells, so what is pinned is the ways it could lie:
   a comparison drawn from too few rounds, a skill named that nobody can
   do anything about, a floor that reads a good week as a bad one, and a
   nought counted where nothing was measured. */

function round(over: Partial<Round> = {}): Round {
  return {
    id: 1,
    at: "2026-09-01T12:00:00Z",
    genre_slug: "general",
    prep_seconds: 60,
    setting: 60,
    spoken: 60,
    stall: 1,
    silence: 10,
    gaps: 0,
    restarts: 0,
    timed: true,
    ended: true,
    ums: 1,
    distinct: 80,
    leaned: {},
    answered: null,
    point_at: null,
    ...over,
  };
}

/* Fourteen rounds that get better: quiet and stalling at first, steady at
   the end, with "like" fading out and one hot take a week. */
const IMPROVING: Round[] = Array.from({ length: 14 }, (_, i) =>
  round({
    id: i + 1,
    at: `2026-08-${String(25 + Math.min(i, 6)).padStart(2, "0")}T12:00:00Z`,
    genre_slug: i % 4 === 0 ? "hot-takes" : "stories",
    prep_seconds: i % 5 === 4 ? 0 : 60,
    stall: 4.6 - i * 0.25,
    silence: 27 - i * 1.3,
    restarts: i < 7 ? 2 : 0,
    spoken: i < 5 ? 48 : 60,
    ended: i >= 3,
    leaned: { like: Math.max(0, 9 - i), so: 1 },
    distinct: 60 + i * 2,
  }),
);

describe("thenAndNow", () => {
  it("compares the first five rounds with the last five, one plain sentence per skill", () => {
    const shown = thenAndNow(IMPROVING);
    expect(shown?.k).toBe(COMPARE_MOST);
    const silence = shown?.rows.find((row) => row.skill.key === "silence");
    // 27, 25.7, 24.4, 23.1, 21.8 against 15.3, 14, 12.7, 11.4, 10.1.
    expect(silence?.sentence).toBe("You are quiet for 13 seconds of your minute. It was 24.");
    expect(silence?.inside).toBe(true);
  });

  it("tracks the word you lean on most, by name", () => {
    const shown = thenAndNow(IMPROVING);
    expect(shown?.word).toBe("like");
    // Nine, eight, seven, six, five a round at first; gone by the last five.
    expect(shown?.rows.find((row) => row.skill.key === "habit")?.sentence).toBe(
      'You say "like" 0 times a round. It was 7.',
    );
  });

  it("waits for six rounds, the least that says something about a person rather than a day", () => {
    expect(thenAndNow(IMPROVING.slice(0, SIX - 1))).toBeNull();
    expect(thenAndNow(IMPROVING.slice(0, SIX))?.k).toBe(3);
  });

  it("leaves out a skill nothing could be measured on rather than calling it nought", () => {
    const untimed = IMPROVING.map((r) => ({ ...r, timed: false, ended: null, distinct: null, leaned: {} }));
    const keys = thenAndNow(untimed)?.rows.map((row) => row.skill.key);
    expect(keys).toEqual(["silence", "stall", "spoken"]);
  });

  it("counts a clean ending as a share of the rounds that had a transcript", () => {
    const shown = thenAndNow(IMPROVING);
    expect(shown?.rows.find((row) => row.skill.key === "ended")?.sentence).toBe(
      "You end on a full stop in 5 of 5 rounds. It was 2 of 5.",
    );
  });
});

describe("workOn", () => {
  it("names the skill furthest from comfortable over the last five rounds, and the round that shows it worst", () => {
    const rounds = IMPROVING.map((r, i) => (i >= 9 ? { ...r, stall: 5 + (i === 11 ? 2 : 0) } : r));
    const pick = workOn(rounds);
    expect(pick && !pick.none && pick.skill.key).toBe("stall");
    expect(pick && !pick.none && pick.worst.id).toBe(12);
    expect(pick && !pick.none && pick.out).toBe(5);
  });

  it("never names range, since there is nothing to tell somebody to do about it", () => {
    const narrow = IMPROVING.map((r) => ({ ...r, distinct: 40 }));
    const pick = workOn(narrow);
    expect(pick && !pick.none && pick.skill.key).not.toBe("distinct");
  });

  it("says so when everything sat in the comfortable stretch", () => {
    expect(workOn(IMPROVING.slice(-5))).toEqual({ none: true, looked: 5 });
  });

  it("reads the worst round on a skill where higher is better as the lowest", () => {
    const rounds = IMPROVING.map((r, i) => ({ ...r, spoken: i === 12 ? 30 : 45 }));
    const pick = workOn(rounds);
    expect(pick && !pick.none && pick.skill.key).toBe("spoken");
    expect(pick && !pick.none && pick.worst.id).toBe(13);
  });
});

describe("floor", () => {
  it("puts your quietest recent round against your first rounds' average", () => {
    const shown = floor(IMPROVING);
    expect(shown?.k).toBe(7);
    expect(shown?.worstNow).toBeCloseTo(17.9, 1);
    expect(shown?.avgThen).toBeCloseTo(23.1, 1);
    expect(shown?.beats).toBe(true);
  });

  it("is nothing under six rounds", () => {
    expect(floor(IMPROVING.slice(0, 5))).toBeNull();
  });
});

describe("byGenre and byPrep", () => {
  it("puts the hardest genre first and needs two to compare", () => {
    const rows = byGenre(IMPROVING);
    expect(rows?.map((row) => row.slug)).toEqual(["hot-takes", "stories"]);
    expect(byGenre(IMPROVING.map((r) => ({ ...r, genre_slug: "general" })))).toBeNull();
  });

  it("compares starting with no time to think against starting with some, once both have happened", () => {
    expect(byPrep(IMPROVING)).not.toBeNull();
    expect(byPrep(IMPROVING.map((r) => ({ ...r, prep_seconds: 60 })))).toBeNull();
  });
});

describe("habitWord and fit", () => {
  it("picks the word leaned on most across the window, alphabetical in a tie", () => {
    expect(habitWord(IMPROVING)).toBe("like");
    expect(habitWord([round({ leaned: { so: 2 } }), round({ leaned: { basically: 2 } })])).toBe("basically");
    expect(habitWord([round()])).toBeNull();
  });

  it("is a hundred inside the comfortable stretch and nothing at the end of the scale", () => {
    const [silence] = [thenAndNow(IMPROVING)!.rows[0].skill];
    expect(fitOf(silence, 10)).toBe(100);
    expect(fitOf(silence, 40)).toBe(0);
  });
});
