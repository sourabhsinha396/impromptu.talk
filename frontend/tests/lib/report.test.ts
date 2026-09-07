import { describe, expect, it } from "vitest";

import {
  AWKWARD,
  RUN_ON,
  advice,
  at,
  axes,
  bands,
  blocks,
  clock,
  distinctWords,
  fit,
  headline,
  marked,
  paceCaption,
  saidCount,
  sentenceCaption,
  shapeCaption,
  slices,
  waveform,
  type Report,
} from "@/lib/report";

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
    at: "2026-09-07T12:00:00Z",
    genre_slug: "general",
    transcript: "",
    seconds_left: 300,
    pace_curve: [],
    filler_times: [],
    filler_counts: [],
    leaned_on: [],
    restarts: [],
    repeats: [],
    sentences: [],
    ended_clean: false,
    usual: null,
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

describe("waveform", () => {
  it("draws strokes where there was a voice and a flat line where there was not", () => {
    const marks = waveform(blocks(report({ opening_stall: 10, speaking_seconds: 40, pauses: [] }), 60));
    const strokes = marks.filter((mark) => mark.kind === "stroke");
    const lines = marks.filter((mark) => mark.kind === "line");
    expect(lines).toEqual([{ kind: "line", from: 0, to: expect.closeTo(16.67, 1), tone: "gap", seconds: 10 }]);
    expect(strokes.length).toBeGreaterThan(10);
    expect(strokes.every((mark) => mark.kind === "stroke" && mark.x > 16.6 && mark.x < 83.4)).toBe(true);
  });

  it("gives even the shortest word one stroke, and draws nothing after the last one", () => {
    const marks = waveform(blocks(report({ opening_stall: 0, speaking_seconds: 0.1, pauses: [] }), 60));
    expect(marks.filter((mark) => mark.kind === "stroke")).toHaveLength(1);
    expect(marks.filter((mark) => mark.kind === "line")).toHaveLength(0);
  });

  it("is the same picture twice, since a report has to repeat", () => {
    const shown = report({ opening_stall: 2, speaking_seconds: 30, pauses: [{ at: 12, seconds: 2, awkward: true }] });
    expect(waveform(blocks(shown, 60))).toEqual(waveform(blocks(shown, 60)));
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

  it("agrees with the headline about what counts as a hole", () => {
    // The headline calls a gap notable at AWKWARD; the band has to call
    // the same gap a hole, or the report argues with itself.
    const verdict = (gap: number) => bands(report({ longest_pause: gap })).find((b) => b.key === "gap")?.verdict;
    expect(verdict(AWKWARD - 0.1)).toBe("No holes");
    expect(verdict(AWKWARD + 0.1)).toBe("Long hole");
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

/* The round's own page. A shape, a donut and a line, all of them drawn from
   the same numbers the bands use, so what is pinned is that the arithmetic
   agrees with itself: inside the comfortable stretch is 100 on the radar,
   the fillers axis is never a bar, and the caption names what the shape
   shows. */

const SPOKEN = report({
  words: 120,
  pace: 143,
  fillers: 9,
  filler_rate: 8.9,
  filler_words: ["um", "uh"],
  opening_stall: 1,
  longest_pause: 1,
  trail_off: 0.5,
  transcript: "So um I said, uh, I said we begin. We begin now, so we do.",
  pace_curve: [
    { start: 0, end: 10, wpm: 156 },
    { start: 10, end: 20, wpm: 210 },
    { start: 20, end: 30, wpm: 78 },
  ],
  filler_counts: [
    { word: "um", count: 6 },
    { word: "uh", count: 3 },
  ],
  leaned_on: [
    { word: "so", count: 3 },
    { word: "like", count: 2 },
  ],
  sentences: [
    { text: "one", words: 56 },
    { text: "two", words: 10 },
  ],
});

describe("axes", () => {
  it("puts the fillers on the shape and never on a bar, since the donut says it as words", () => {
    const rows = axes(SPOKEN);
    expect(rows.map((row) => row.key)).toEqual(["pace", "start", "gap", "sentence", "fillers"]);
    expect(rows.find((row) => row.key === "fillers")?.radarOnly).toBe(true);
    expect(rows.filter((row) => !row.radarOnly).map((row) => row.key)).not.toContain("fillers");
  });

  it("has no fillers axis where nothing could count them, and no sentence axis without a transcript", () => {
    expect(axes(report({ pace: 150, words: 10 })).map((row) => row.key)).toEqual(["pace", "start", "gap"]);
  });

  it("carries your usual onto each axis when there is one", () => {
    const rows = axes(report({ ...SPOKEN, usual: { pace: 148, stall: 3.1, gap: 2.4, fillers: 3.2, sentence: 24, rounds: 12 } }));
    expect(rows.map((row) => row.usual)).toEqual([148, 3.1, 2.4, 24, 3.2]);
  });
});

describe("fit", () => {
  it("is a hundred anywhere inside the comfortable stretch and falls to nothing at the end of the scale", () => {
    const [pace] = axes(SPOKEN);
    expect(fit(pace, 130)).toBe(100);
    expect(fit(pace, 170)).toBe(100);
    expect(fit(pace, 220)).toBe(0);
    expect(fit(pace, 195)).toBe(50);
    expect(fit(pace, 80)).toBe(0);
  });

  it("is nothing at all without a value, which is how an absent usual stays off the shape", () => {
    expect(fit(axes(SPOKEN)[0], null)).toBeNull();
  });
});

describe("shapeCaption", () => {
  it("counts what landed and names the furthest out", () => {
    // Nine ums a minute is well past four, and a 56-word sentence is
    // further past 35 still, so the sentence is the one named.
    expect(shapeCaption(axes(SPOKEN))).toBe("3 of 5 in the comfortable range · furthest out: longest sentence");
  });

  it("says so when everything landed", () => {
    const rows = axes(report({ ...SPOKEN, filler_rate: 2, sentences: [{ text: "x", words: 12 }] }));
    expect(shapeCaption(rows)).toBe("All 5 in the comfortable range");
  });
});

describe("paceCaption", () => {
  it("names the fastest stretch and the slowest, and the fade when there was one", () => {
    expect(paceCaption(SPOKEN)).toBe(
      "Fastest from 0:10, 210 words a minute. Slowest from 0:20, 78. You faded in the last stretch.",
    );
  });

  it("says nothing under two readings", () => {
    expect(paceCaption(report({ pace_curve: [{ start: 0, end: 10, wpm: 100 }] }))).toBeNull();
  });
});

describe("slices", () => {
  it("puts the fillers first, warm, then the leaned-on words, and the whole minute is the share", () => {
    const cut = slices(SPOKEN);
    expect(cut.map((slice) => slice.kind)).toEqual(["filler", "filler", "crutch", "crutch"]);
    expect(cut.reduce((sum, slice) => sum + slice.count, 0)).toBe(14);
    expect(saidCount(SPOKEN)).toBe(129);
  });

  it("steps each group down in shade so two ums and two crutches can be told apart", () => {
    const [um, uh] = slices(SPOKEN);
    expect(um.shade).toBeGreaterThan(uh.shade);
  });
});

describe("sentences and words", () => {
  it("calls a sentence past the edge a run-on and a short one landed", () => {
    expect(sentenceCaption(SPOKEN)).toBe("One ran to 56 words. Land a full stop and let it sit.");
    expect(sentenceCaption(report({ sentences: [{ text: "x", words: RUN_ON }] }))).toBe(
      `Longest ${RUN_ON} words. Every one of them landed.`,
    );
  });

  it("counts different words with the fillers left out", () => {
    // so i said we begin now do: the ums and uhs are not words anybody chose.
    expect(distinctWords(SPOKEN)).toBe(7);
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
