import { describe, expect, it } from "vitest";

import { blocks, clock, headline, type Report } from "@/lib/report";

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

describe("clock", () => {
  it("reads as a stopwatch", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(7)).toBe("0:07");
    expect(clock(65)).toBe("1:05");
    expect(clock(-3)).toBe("0:00");
  });
});
