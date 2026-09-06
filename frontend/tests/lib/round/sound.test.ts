import { describe, expect, it } from "vitest";

import { SPIN_MS, Sound, clickOffsets } from "@/lib/round/sound";

/* Enough of Web Audio to count what was scheduled and when. */
function fakeContext(state: AudioContextState = "running") {
  const notes: { freq: number; at: number; type: string }[] = [];
  let resumed = 0;
  const ctx = {
    currentTime: 10,
    state,
    destination: {},
    resume: async () => {
      resumed++;
    },
    createGain: () => ({
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: () => ({ connect() {} }),
    }),
    createOscillator: () => {
      const osc = {
        type: "sine",
        frequency: { value: 0 },
        connect: () => ({ connect: () => ({}) }),
        start: (at: number) => notes.push({ freq: osc.frequency.value, at, type: osc.type }),
        stop() {},
      };
      return osc;
    },
  };
  return { ctx: ctx as unknown as AudioContext, notes, resumed: () => resumed };
}

describe("sound", () => {
  it("spaces the reel's clicks so they decelerate, ending on the settle", () => {
    const offsets = clickOffsets(11);
    const gaps = offsets.slice(1).map((t, i) => t - offsets[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(offsets.at(-1)).toBeCloseTo(SPIN_MS, 6);
  });

  it("plays a click per row and the winner a fifth up, ticks at 1000Hz, chimes once or twice", () => {
    const { ctx, notes, resumed } = fakeContext("suspended");
    const sound = new Sound(() => true, () => ctx);
    sound.arm();
    expect(resumed()).toBe(1);
    sound.play({ type: "sound", sound: "spin", rows: 11 });
    expect(notes).toHaveLength(12);
    expect(notes.at(-1)).toMatchObject({ freq: 1568, at: 10 + SPIN_MS / 1000 });
    notes.length = 0;
    sound.play({ type: "sound", sound: "tick" });
    expect(notes).toEqual([{ freq: 1000, at: 10, type: "triangle" }]);
    notes.length = 0;
    sound.play({ type: "sound", sound: "chime2" });
    expect(notes.map((n) => n.freq)).toEqual([880, 880]);
  });

  it("is silent when muted, and a courtesy that never throws", () => {
    const { ctx, notes } = fakeContext();
    const muted = new Sound(() => false, () => ctx);
    muted.arm();
    muted.play({ type: "sound", sound: "chime" });
    expect(notes).toHaveLength(0);

    const broken = new Sound(
      () => true,
      () => {
        throw new Error("no audio here");
      },
    );
    expect(() => {
      broken.arm();
      broken.play({ type: "sound", sound: "tick" });
    }).not.toThrow();
  });
});
