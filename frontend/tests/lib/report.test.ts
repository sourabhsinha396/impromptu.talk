import { describe, expect, it } from "vitest";

import { advice, at, bands, blocks, clock, headline, marked, type Report } from "@/lib/report";

/* The bar is the whole report: somebody sees the hole at 0:34 without
   reading a number. So what is pinned here is that it adds up - the blocks
   tile the minute end to end with no gaps and no overlaps - and that the
   one line under it says the most useful true thing rather than the first
   thing that matched. */

function report(over: Partial<Report> = {}): Report {
  return {
    heard: true,
    speaking_seconds: 50,
    opening_stall: 0,
    pauses: [],
    longest_pause: 0,
    awkward_pauses: 0,
    speaking_ratio: 0.9,
    trail_off: 1,
    words: null,
    pace: null,
    fillers: null,
    filler_rate: null,
    crutch_words: [],
    filler_words: [],
    fillers_at_transitions: null,
    said: [],
    topic: "Low tide",
    transcript: "",
    seconds_left: 300,
    ...over,
  };
}

describe("blocks", () => {
  it("tiles the whole minute with no gap and no overlap", () => {
    const parts = blocks(
      report({ opening_stall: 4, speaking_seconds: 44, pauses: [{ at: 20, seconds: 2, awkward: true }] }),
      60,
    );
    expect(parts[0].at).toBe(0);
    for (const [before, after] of parts.slice(0, -1).map((b, i) => [b, parts[i + 1]] as const)) {
      expect(before.at + before.width).toBeCloseTo(after.at, 5);
    }
    const last = parts[parts.length - 1];
    expect(last.at + last.width).toBeCloseTo(100, 5);
  });

  it("draws the opening silence, the talking and the gap in order", () => {
    const parts = blocks(
      report({ opening_stall: 6, speaking_seconds: 50, pauses: [{ at: 30, seconds: 4, awkward: true }] }),
      60,
    );
    expect(parts.slice(0, 3).map((b) => b.kind)).toEqual(["gap", "talking", "gap"]);
    expect(parts[0].seconds).toBe(6);
    expect(parts[2].seconds).toBe(4);
  });

  it("marks a breath differently from a hole", () => {
    const parts = blocks(
      report({ speaking_seconds: 55, pauses: [{ at: 20, seconds: 0.5, awkward: false }] }),
      60,
    );
    expect(parts.find((b) => b.seconds === 0.5)?.kind).toBe("breath");
  });

  it("draws nothing at all when nothing was heard", () => {
    expect(blocks(report({ heard: false }), 60)).toEqual([]);
    expect(blocks(report(), 0)).toEqual([]);
  });

  it("leaves the rest of the clock alone when somebody finished early", () => {
    // Twenty seconds of talking in a sixty second round: the last forty are
    // having finished, which is data and not a failure.
    const parts = blocks(report({ speaking_seconds: 20 }), 60);
    const last = parts[parts.length - 1];
    // "after", never "gap": answering in twenty seconds is a short answer,
    // not a forty-second hole, and the bar must not paint it as one.
    expect(last.kind).toBe("after");
    expect(last.width).toBeCloseTo((40 / 60) * 100, 1);
  });
});

describe("headline", () => {
  it("names the microphone before anything else", () => {
    expect(headline(report({ heard: false }))).toMatch(/microphone/);
  });

  it("leads with the opening stall, which is the impromptu failure", () => {
    expect(headline(report({ opening_stall: 5, longest_pause: 9 }))).toMatch(/to start/);
  });

  it("falls through to the longest gap, then the fade, then the ums", () => {
    expect(headline(report({ longest_pause: 4 }))).toMatch(/longest gap/);
    expect(headline(report({ trail_off: 0.3 }))).toMatch(/faded/);
    expect(headline(report({ fillers: 9, filler_rate: 9 }))).toMatch(/um 9 times/);
  });

  it("says something true rather than nothing when the round went well", () => {
    expect(headline(report())).toBe("Steady all the way through.");
  });

  it("never mentions ums when nothing counted them", () => {
    // Whisper deletes fillers before anybody asks, so free rounds carry
    // null and must never be described as having none.
    expect(headline(report({ fillers: null, filler_rate: null }))).not.toMatch(/um/);
  });
});

describe("marked", () => {
  it("marks what was counted and leaves the rest of the sentence alone", () => {
    const parts = marked(
      report({ transcript: "Um, so I really think so.", filler_words: ["um"], crutch_words: [{ word: "so", count: 2 }] }),
    );
    expect(parts.filter((p) => p.kind === "filler").map((p) => p.text)).toEqual(["Um"]);
    expect(parts.filter((p) => p.kind === "crutch").map((p) => p.text)).toEqual(["so", "so"]);
    // Punctuation and spacing survive, or it stops reading like speech.
    expect(parts.map((p) => p.text).join("")).toBe("Um, so I really think so.");
  });

  it("is nothing at all without a transcript", () => {
    expect(marked(report())).toEqual([]);
    expect(marked(report({ transcript: "   " }))).toEqual([]);
  });

  it("marks nothing when the transcriber could not count fillers", () => {
    // Groq deletes them, so the backend sends no filler words and the page
    // must not imply a clean round by marking none.
    const parts = marked(report({ transcript: "um so we begin", filler_words: [], crutch_words: [] }));
    expect(parts.every((p) => p.kind === "")).toBe(true);
  });
});

describe("bands", () => {
  it("calls a comfortable pace comfortable and names both ways out of it", () => {
    const verdict = (pace: number) => bands(report({ pace })).find((b) => b.key === "pace")?.verdict;
    expect(verdict(150)).toBe("Good pace");
    expect(verdict(100)).toBe("Slow");
    expect(verdict(200)).toBe("Rushed");
  });

  it("never shows a pace band when nothing counted the words", () => {
    expect(bands(report({ pace: null })).some((b) => b.key === "pace")).toBe(false);
    expect(bands(report({ pace: 0 })).some((b) => b.key === "pace")).toBe(false);
  });

  it("shows the ums only where a transcriber could count them", () => {
    expect(bands(report({ filler_rate: 2 })).some((b) => b.key === "fillers")).toBe(true);
    expect(bands(report({ filler_rate: null })).some((b) => b.key === "fillers")).toBe(false);
  });

  it("always shows the two the browser can prove on its own", () => {
    const keys = bands(report()).map((b) => b.key);
    expect(keys).toContain("start");
    expect(keys).toContain("gap");
  });

  it("says nothing is wrong with a round that went well", () => {
    const good = bands(report({ opening_stall: 0.5, longest_pause: 1, pace: 150, filler_rate: 1 }));
    expect(good.map((b) => b.verdict)).toEqual(["Good pace", "Straight in", "No holes", "Clean"]);
  });
});

describe("at", () => {
  it("places a value across the scale as a percentage", () => {
    expect(at(150, [100, 200])).toBe(50);
    expect(at(100, [100, 200])).toBe(0);
  });

  it("keeps a wild number on the track rather than off it", () => {
    expect(at(500, [100, 200])).toBe(100);
    expect(at(-40, [100, 200])).toBe(0);
    expect(at(5, [10, 10])).toBe(0);
  });
});

describe("advice", () => {
  const band = (key: string, pace: number) => bands(report({ pace, opening_stall: 0.5, longest_pause: 1, filler_rate: 1 })).find((b) => b.key === key)!;

  it("says nothing at all about a round that went well", () => {
    expect(advice(band("pace", 150))).toBeNull();
    expect(advice(band("start", 150))).toBeNull();
  });

  it("says opposite things about the two ways out of a range", () => {
    const slow = advice(band("pace", 90));
    const fast = advice(band("pace", 210));
    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();
    expect(slow).not.toBe(fast);
  });

  it("is the same sentence every time, since a report has to repeat", () => {
    // Written here rather than by a model: the same round giving different
    // advice on two readings is weather, not advice.
    expect(advice(band("pace", 210))).toBe(advice(band("pace", 210)));
  });
});

describe("clock", () => {
  it("reads as a stopwatch", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(7)).toBe("0:07");
    expect(clock(65)).toBe("1:05");
    expect(clock(-3)).toBe("0:00");
  });
});
