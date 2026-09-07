import { describe, expect, it } from "vitest";

import {
  answeredCount,
  caseBlocks,
  hasPoint,
  pointAt,
  pointMoved,
  readRounds,
  rolesUsed,
  SAMPLE_ROUNDS,
} from "@/lib/case";
import type { Round, Sentence } from "@/lib/report";

/* The arithmetic under "the case you made". The model hands back a role
   per sentence and one word; everything here turns those into what the
   page draws, and the edges that matter are the ones where a round could
   be accused of something it did not do. */

function sentence(role: Sentence["role"], at: number | null, end: number | null): Sentence {
  return { text: `a sentence at ${at}`, words: 8, role, at, end };
}

function round(answered: Round["answered"], point_at: number | null, id = 1): Round {
  return { ...SAMPLE_ROUNDS[0], id, answered, point_at };
}

describe("the sentences on the minute", () => {
  it("places each one where it was said, as a share of the round", () => {
    const blocks = caseBlocks([sentence("point", 0, 15), sentence("example", 30, 60)], 60);
    expect(blocks.map((block) => [block.at, block.width])).toEqual([
      [0, 25],
      [50, 50],
    ]);
  });

  it("leaves out a sentence the word clock could not place", () => {
    const blocks = caseBlocks([sentence("point", 2, 8), sentence("close", null, null)], 60);
    expect(blocks).toHaveLength(1);
  });
});

describe("the point", () => {
  it("is the second the first sentence that made it began", () => {
    expect(pointAt([sentence("setup", 0, 4), sentence("point", 5, 9)])).toBe(5);
  });

  it("is not called a miss when the round made one and nothing timed it", () => {
    /* "no point made" is drawn from hasPoint, never from a missing clock:
       one is a fact about the speaking and the other about the words. */
    const said = [sentence("point", null, null)];
    expect(pointAt(said)).toBeNull();
    expect(hasPoint(said)).toBe(true);
  });

  it("is absent when no sentence did what the topic asked", () => {
    expect(hasPoint([sentence("setup", 0, 4), sentence("aside", 5, 9)])).toBe(false);
  });
});

describe("the key", () => {
  it("holds only the roles this round used, in the order it reads them", () => {
    const said = [sentence("close", 0, 1), sentence("example", 2, 3), sentence("point", 4, 5)];
    expect(rolesUsed(said)).toEqual(["point", "example", "close"]);
  });
});

describe("across rounds", () => {
  it("leaves out a round nothing read rather than drawing it as a miss", () => {
    /* Not answering and not being counted are different things, and ten
       squares that confused them would tell somebody they had missed the
       topic on a day nobody asked. */
    const rounds = [round("yes", 4, 1), round(null, null, 2), round("no", null, 3)];
    expect(readRounds(rounds).map((one) => one.id)).toEqual([1, 3]);
  });

  it("keeps the last ten and counts the ones that answered", () => {
    const many = Array.from({ length: 14 }, (_, index) => round(index % 2 ? "yes" : "half", 5, index));
    const shown = readRounds(many);
    expect(shown).toHaveLength(10);
    expect(shown[0].id).toBe(4);
    expect(answeredCount(shown)).toBe(5);
  });

  it("says which way the time to the point moved, and says nothing from one reading", () => {
    expect(pointMoved([round("yes", 40, 1), round("yes", 6, 2)])).toEqual({ from: 40, to: 6 });
    expect(pointMoved([round("yes", 40, 1), round("no", null, 2)])).toBeNull();
  });
});
