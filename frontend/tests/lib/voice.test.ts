import { afterEach, describe, expect, it, vi } from "vitest";

import { Listener, SAMPLE_HZ, filenameFor, level, segmentsFrom } from "@/lib/round/voice";

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

/* Enough of the browser to open a microphone: a stream with one track, and
   a Web Audio context whose analyser always hears the same loud level. One
   level throughout is somebody who never stops, which segmentsFrom reports
   as a single segment the length of the timeline, so the segment's end is
   the clock the ticker kept.

   A held microphone answers only when the test says so, which is what a
   real permission prompt does and what an instantly resolved fake cannot
   reproduce: the leak being pinned lives in that gap. */
function fakeMicrophone({ hold = false } = {}) {
  const track = { readyState: "live", stop: vi.fn(), getSettings: () => ({}) };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  let answer = () => {};
  const getUserMedia = vi.fn(
    () =>
      new Promise<typeof stream>((resolve) => {
        answer = () => resolve(stream);
        if (!hold) answer();
      }),
  );
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  vi.stubGlobal(
    "AudioContext",
    class {
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          getFloatTimeDomainData(frame: Float32Array) {
            frame.fill(LOUD);
          },
        };
      }
      async close() {}
    },
  );
  return { getUserMedia, track, answer: () => answer() };
}

describe("Listener", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it("starting twice does not double the sample rate", async () => {
    // The topic screen starts the listener on every landing, and a respin
    // or a reset from prep or speak lands there again. Each of those once
    // opened another ticker into the same timeline, so a round after three
    // spins was measured three times fast.
    vi.useFakeTimers();
    const mic = fakeMicrophone();
    const ears = new Listener();
    expect(await ears.start()).toBe(true);
    expect(await ears.start()).toBe(true);
    expect(await ears.start()).toBe(true);
    ears.mark();
    vi.advanceTimersByTime(2000);
    const heard = await ears.stop();
    expect(mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(heard.segments).toEqual([[0, 2]]);
  });

  it("a stop that lands while the microphone is still being asked for closes it when it arrives", async () => {
    // Reset to idle inside the permission moment. The first version's stop
    // found no stream to close, and the one that arrived a beat later was
    // left open under the idle screen.
    const mic = fakeMicrophone({ hold: true });
    const ears = new Listener();
    const opening = ears.start();
    const stopped = ears.stop();
    mic.answer();
    await stopped;
    expect(await opening).toBe(true);
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
  });
});
