import { describe, expect, it } from "vitest";

import type { Bank } from "@/lib/bank";
import { REEL_DECOYS, decoysFor, draw, ownStyles, pool, settledStyle } from "@/lib/round/pool";
import { DEFAULT_PREFS, type Prefs } from "@/lib/round/prefs";

function topic(genre: string, text: string, style = "just-talk") {
  return { text, genre, style, slug: text.toLowerCase().replace(/\s+/g, "-") };
}

const bank: Bank = {
  genres: [
    { slug: "general", name: "General", icon: "dices", blurb: "" },
    { slug: "career", name: "Career", icon: "briefcase", blurb: "" },
    { slug: "mine", name: "Mine", icon: "sparkles", blurb: "", own: true },
  ],
  topics: [
    topic("general", "Low tide"),
    topic("general", "Queues"),
    topic("general", "Tipping should end", "hot-take"),
    topic("career", "Your first job"),
    topic("career", "Job titles are meaningless", "hot-take"),
    topic("mine", "Our standup", "IELTS style"),
    { ...topic("general", "A castle"), image: "/topics/castle-in-mist.webp" },
  ],
  styles: [
    { key: "surprise", label: "Surprise me", hint: "" },
    { key: "just-talk", label: "Just talk", hint: "" },
    { key: "hot-take", label: "Hot take", hint: "" },
    { key: "explain", label: "Explain it simply", hint: "" },
    { key: "story", label: "Tell a story", hint: "" },
  ],
};

const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...over });

/* A "random" that walks a fixed sequence, so a draw is reproducible. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("the pool", () => {
  it("narrows by style, and falls back to the genre and then the bank rather than emptying", () => {
    expect(pool(bank, prefs({ genre: "general", style: "hot-take" })).map((t) => t.text)).toEqual(["Tipping should end"]);
    /* No story in General: the filter is ignored, not obeyed into an empty reel. */
    expect(pool(bank, prefs({ genre: "general", style: "story" }))).toHaveLength(4);
    /* A genre with nothing in it hands the whole bank over. */
    expect(pool(bank, prefs({ genre: "empty" }))).toHaveLength(bank.topics.length);
  });

  it("keeps picture mode's promise: a picture from the genre, or from anywhere, but never a sentence", () => {
    /* The other narrowings are preferences and fall back to a sentence
       happily. This one is a promise about what the next screen holds,
       and a sentence would be the mode silently not working. */
    expect(pool(bank, prefs({ genre: "general", pictures: true })).map((t) => t.text)).toEqual(["A castle"]);
    /* Career has no picture of its own, so it borrows one rather than
       handing back one of its sentences. */
    expect(pool(bank, prefs({ genre: "career", pictures: true })).map((t) => t.text)).toEqual(["A castle"]);
    /* The style is not applied on top: a picture bank is thin, and two
       filters at once would empty it for the sake of the weaker one. */
    expect(pool(bank, prefs({ genre: "general", pictures: true, style: "hot-take" })).map((t) => t.text)).toEqual([
      "A castle",
    ]);
    /* A bank with no pictures at all is the one case that gives way,
       because there is nothing else it could hand over. */
    const noPictures = { ...bank, topics: bank.topics.filter((t) => !t.image) };
    expect(pool(noPictures, prefs({ genre: "general", pictures: true })).length).toBeGreaterThan(0);
  });

  it("still finds decoys for a picture topic, because a picture round spins too", () => {
    /* The page swaps the strip of sentences for a strip of skeletons and
       lands on the photograph; only the rows differ, never the count or
       the timing, so the two rounds feel like one product. */
    const picture = bank.topics.find((t) => t.image)!;
    expect(decoysFor(bank, prefs({ genre: "general", pictures: true }), picture, sequence(0.3))).toHaveLength(
      REEL_DECOYS,
    );
  });

  it("never hands back a topic until the pool has run dry, then starts over", () => {
    const used = new Set<string>();
    const source = pool(bank, prefs({ genre: "general" }));
    const seen = source.map(() => {
      const t = draw(source, used, () => 0)!;
      used.add(t.text);
      return t.text;
    });
    expect(new Set(seen).size).toBe(source.length);
    /* The next draw is allowed to repeat, because everything has been used. */
    expect(draw(source, used, () => 0)!.text).toBe(seen[0]);
  });

  it("finds eleven decoys by borrowing from the genre and the bank, repeating before giving up", () => {
    const winner = bank.topics[2];
    const decoys = decoysFor(bank, prefs({ genre: "general", style: "hot-take" }), winner, sequence(0.3, 0.7, 0.1));
    expect(decoys).toHaveLength(REEL_DECOYS);
    expect(decoys).not.toContain(winner.text);
    expect(new Set(decoys).size).toBe(bank.topics.length - 1);
  });

  it("keeps a coined style only inside the genre that coined it", () => {
    expect(ownStyles(bank, "mine")).toEqual(["IELTS style"]);
    expect(ownStyles(bank, "general")).toEqual([]);
    expect(settledStyle(bank, prefs({ genre: "mine", style: "IELTS style" }))).toBe("IELTS style");
    expect(settledStyle(bank, prefs({ genre: "general", style: "IELTS style" }))).toBe("surprise");
    expect(settledStyle(bank, prefs({ genre: "general", style: "hot-take" }))).toBe("hot-take");
  });
});
