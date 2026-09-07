import { describe, expect, it } from "vitest";

import { SAMPLE_HZ, filenameFor, level, segmentsFrom } from "@/lib/round/voice";

/* Turning loudness into "when there was a voice" is the whole free report:
   the pause map, the opening stall and trail-off are all read off these
   segments. It is also the kind of arithmetic that fails quietly, so what
   is pinned here is the behaviour that would otherwise go wrong without
   anybody noticing - a fluent minute reported as forty pauses, a silent
   room promoted to speech, or a pause measured a fifth of a second short
   because the hangover was counted as talking. */

const QUIET = 0.002;
const LOUD = 0.2;

/** Frames of a given loudness, in seconds. */
function run(seconds: number, value: number): number[] {
  return new Array(Math.round(seconds * SAMPLE_HZ)).fill(value);
}

describe("level", () => {
  it("is zero for silence and rises with the signal", () => {
    expect(level(new Float32Array(64))).toBe(0);
    expect(level(new Float32Array(64).fill(0.5))).toBeCloseTo(0.5, 5);
  });

  it("survives an empty frame rather than dividing by nothing", () => {
    expect(level(new Float32Array(0))).toBe(0);
  });
});

describe("segmentsFrom", () => {
  it("finds one stretch of talking after a silent start", () => {
    const segments = segmentsFrom([...run(2, QUIET), ...run(10, LOUD)]);
    expect(segments).toHaveLength(1);
    expect(segments[0][0]).toBeCloseTo(2, 1);
    expect(segments[0][1]).toBeCloseTo(12, 1);
  });

  it("splits on a real pause and reports the gap between the two", () => {
    const segments = segmentsFrom([...run(5, LOUD), ...run(3, QUIET), ...run(5, LOUD)]);
    expect(segments).toHaveLength(2);
    // The hangover keeps the phrase open briefly, but it is not counted as
    // talking: the gap stays close to the three seconds of real silence.
    expect(segments[1][0] - segments[0][1]).toBeGreaterThan(2.5);
  });

  it("does not split a phrase on the gap between two words", () => {
    // 100ms quiet, which is inside the hangover.
    const segments = segmentsFrom([...run(3, LOUD), ...run(0.1, QUIET), ...run(3, LOUD)]);
    expect(segments).toHaveLength(1);
  });

  it("reports nothing at all for a silent room rather than promoting hiss", () => {
    expect(segmentsFrom(run(60, QUIET))).toEqual([]);
    expect(segmentsFrom(run(60, 0))).toEqual([]);
  });

  it("drops a click or a chair that is shorter than a syllable", () => {
    expect(segmentsFrom([...run(5, QUIET), ...run(0.04, LOUD), ...run(5, QUIET)])).toEqual([]);
  });

  it("closes the last stretch when the round ends mid-sentence", () => {
    const segments = segmentsFrom([...run(1, QUIET), ...run(9, LOUD)]);
    expect(segments).toHaveLength(1);
    expect(segments[0][1]).toBeCloseTo(10, 1);
  });

  it("adapts to a noisy room instead of using one absolute threshold", () => {
    // A loud fan under everything: speech is still three times the room.
    const noisy = 0.05;
    const segments = segmentsFrom([...run(2, noisy), ...run(6, noisy * 6)]);
    expect(segments).toHaveLength(1);
    expect(segments[0][0]).toBeCloseTo(2, 1);
  });

  it("hears somebody who talks for most of the minute", () => {
    // The threshold was once a multiple of the quiet tenth, which for this
    // recording lands inside the speech: the room came back as the voice
    // and a good speaker was reported as sixty seconds of silence.
    const segments = segmentsFrom([...run(1, QUIET), ...run(55, LOUD), ...run(4, QUIET)]);
    expect(segments).toHaveLength(1);
    expect(segments[0][0]).toBeCloseTo(1, 1);
  });

  it("hears somebody who never stops at all", () => {
    const segments = segmentsFrom(run(60, LOUD));
    expect(segments).toEqual([[0, 60]]);
  });

  it("answers nothing for no input rather than throwing", () => {
    expect(segmentsFrom([])).toEqual([]);
    expect(segmentsFrom([0.1, 0.2], 0)).toEqual([]);
  });
});

describe("filenameFor", () => {
  it("follows the container the browser actually gave, since they differ", () => {
    expect(filenameFor("audio/webm;codecs=opus")).toBe("round.webm");
    expect(filenameFor("audio/ogg;codecs=opus")).toBe("round.ogg");
    expect(filenameFor("audio/mp4")).toBe("round.mp4");
    expect(filenameFor("")).toBe("round.webm");
  });
});
