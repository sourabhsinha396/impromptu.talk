import { describe, expect, it } from "vitest";

import { place, size, step, tally, STEPS } from "@/lib/words";

/* The minute as a cloud. What is pinned here is what the picture is
   allowed to claim: the counting keeps everything, the size and the
   shade say the same thing, and the same transcript draws the same cloud
   twice. */

const SAID = "They are trying and they are trying again. The cats are quiet. Um, they are.";

/* Widths a real face would give, near enough: the packer only needs a
   number, and a test that opened a canvas would be testing a browser. */
const measure = (word: string, px: number) => word.length * px * 0.52;

describe("counting a minute", () => {
  it("keeps every word, pronouns and conjunctions included", () => {
    /* A stop word list would take out "the" and "and", which are the top
       of every round ever spoken. They are also most of what a minute
       is, and a cloud that hides them is a cloud of a minute nobody
       spoke (owner's call). */
    const words = tally(SAID);
    expect(words[0]).toEqual({ word: "are", count: 4 });
    expect(words.map((row) => row.word)).toContain("and");
    expect(words.map((row) => row.word)).toContain("the");
  });

  it("counts a word the same however it was written", () => {
    // "They" opening a sentence and "they" inside one are one word.
    expect(tally("They they THEY")).toEqual([{ word: "they", count: 3 }]);
    expect(tally("it's Its it's")).toEqual([
      { word: "it's", count: 2 },
      { word: "its", count: 1 },
    ]);
  });

  it("orders by count and then by the word, so one transcript tallies one way", () => {
    const words = tally(SAID);
    const ties = words.filter((row) => row.count === 1).map((row) => row.word);
    expect(ties).toEqual([...ties].sort());
  });
});

describe("sizing a word", () => {
  it("takes the root of the share, so the top word does not eat the box", () => {
    /* Straight off the count, a word said eight times against one said
       once is eight times the height and the rest is a hedge. The root
       is what every word cloud since the first one has used. */
    const middle = size(4, 8);
    expect(middle).toBeGreaterThan(size(1, 8) + (size(8, 8) - size(1, 8)) / 2);
  });

  it("shades by the same number it sizes by, strongest for the most said", () => {
    // Colour and size saying one thing is what gives the cloud a middle
    // and edges rather than a field of one tone.
    expect(step(8, 8)).toBe(0);
    expect(step(1, 8)).toBe(STEPS - 1);
    expect(step(4, 8)).toBeLessThan(step(2, 8));
  });
});

describe("packing a cloud", () => {
  const words = tally(SAID);

  it("draws the same round the same way twice", () => {
    /* A picture that rearranged itself between two looks at one minute
       would be saying something had changed when nothing had, so the
       seed is fixed and never the visit's. */
    expect(place(words, measure).placed).toEqual(place(words, measure).placed);
  });

  it("never overlaps two words", () => {
    const { placed } = place(words, measure);
    const boxes = placed.map((word) => {
      const length = measure(word.word, word.size);
      const height = word.size * 0.82;
      const w = word.down ? height : length;
      const h = word.down ? length : height;
      return { x: word.x - w / 2, y: word.y - h / 2, w, h };
    });
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
      }
    }
  });

  it("leaves the word said most across, and trims the view to what it drew", () => {
    /* Across or a quarter turn and never between, and the first word is
       the one somebody reads first, so it is never the turned one. */
    const { placed, box } = place(words, measure);
    expect(placed[0].word).toBe("are");
    expect(placed[0].down).toBe(false);
    expect(box.width).toBeGreaterThan(0);
    for (const word of placed) {
      expect(word.x).toBeGreaterThanOrEqual(box.x);
      expect(word.x).toBeLessThanOrEqual(box.x + box.width);
    }
  });

  it("has nothing to draw for a round nothing transcribed", () => {
    expect(tally("")).toEqual([]);
    expect(place([], measure).placed).toEqual([]);
  });
});
