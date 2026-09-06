import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Timer } from "@/lib/round/timer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Timer", () => {
  it("counts the wall clock, so a throttled tab that fires late cannot gift time", () => {
    const done = vi.fn();
    const timer = new Timer();
    timer.start(60, done);
    expect(timer.text).toBe("1:00");

    /* The loop does not run for thirty seconds, as in a background tab;
       when it does, the clock has still moved on by thirty seconds. */
    vi.setSystemTime(Date.now() + 30_000);
    vi.advanceTimersByTime(100);
    expect(timer.text).toBe("0:30");
    expect(timer.fraction).toBeCloseTo(0.5, 2);

    vi.advanceTimersByTime(30_000);
    expect(done).toHaveBeenCalledOnce();
    expect(timer.running).toBe(false);
    expect(timer.text).toBe("0:00");
  });

  it("pauses the reading and resumes with what was left", () => {
    const done = vi.fn();
    const timer = new Timer();
    timer.start(60, done);
    vi.advanceTimersByTime(10_000);
    timer.pause();
    vi.advanceTimersByTime(60_000);
    expect(timer.text).toBe("0:50");
    expect(done).not.toHaveBeenCalled();
    timer.resume();
    vi.advanceTimersByTime(50_000);
    expect(done).toHaveBeenCalledOnce();
  });

  it("marks each whole second for the metronome and the last ten for the ring", () => {
    const seconds: number[] = [];
    const timer = new Timer({ onSecond: (left) => seconds.push(left) });
    timer.start(12, () => {});
    vi.advanceTimersByTime(3_000);
    expect(seconds).toEqual([11, 10, 9]);
    expect(timer.ending).toBe(true);
    expect(timer.elapsedSeconds).toBe(3);
  });

  it("stops cleanly and never calls a finished round's callback", () => {
    const done = vi.fn();
    const timer = new Timer();
    timer.start(5, done);
    timer.stop();
    vi.advanceTimersByTime(10_000);
    expect(done).not.toHaveBeenCalled();
    expect(timer.running).toBe(false);
  });
});
