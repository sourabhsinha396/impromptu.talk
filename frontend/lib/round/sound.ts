import type { Effect } from "@/lib/round/engine";

/* Three voices: the reel's decelerating clicks, a chime at each change of
   phase, and a once-a-second tick while you are thinking. The tick sits at
   the very edge of attention on purpose, a metronome and not an alarm,
   because during prep your eyes should be anywhere but the screen. It
   stops when you start talking: a tick under your own voice is a second
   speaker in the room and it lands in the recording.

   Every call may fail silently. Sound is a courtesy, never a dependency. */

export const SPIN_MS = 2200;

/* When each click lands, in milliseconds from the start of the spin: the
   reel's ease-out inverted, so ear and eye slow down together. Approximate
   (the CSS bezier is not this exact cubic), but the ear reads
   "decelerating", not milliseconds. */
export function clickOffsets(rows: number): number[] {
  const offsets: number[] = [];
  for (let k = 1; k <= rows; k++) offsets.push((1 - Math.cbrt(1 - k / rows)) * SPIN_MS);
  return offsets;
}

type Context = Pick<AudioContext, "currentTime" | "state" | "resume" | "createOscillator" | "createGain" | "destination">;

export class Sound {
  private ctx: Context | null = null;

  constructor(
    private readonly enabled: () => boolean,
    private readonly make: () => Context | null = () => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return Ctor ? new Ctor() : null;
    },
  ) {}

  /** On a gesture: browsers refuse to start audio anywhere else, and a
      context started on load stays suspended for good. */
  arm(): void {
    if (!this.enabled()) return;
    try {
      this.ctx ??= this.make();
      if (this.ctx?.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private beep(freq: number, at: number, peak: number, decay: number, type: OscillatorType = "sine"): void {
    if (!this.ctx || !this.enabled()) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(at);
      osc.stop(at + decay + 0.02);
    } catch {
      /* A failed note is a silent note. */
    }
  }

  private get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  tick(): void {
    this.beep(1000, this.now, 0.025, 0.03, "triangle");
  }

  chime(times: number): void {
    for (let i = 0; i < times; i++) this.beep(880, this.now + i * 0.28, 0.18, 0.24);
  }

  spin(rows: number): void {
    const start = this.now;
    for (const offset of clickOffsets(rows)) this.beep(1500, start + offset / 1000, 0.06, 0.035, "triangle");
    /* The winner, a fifth up. */
    this.beep(1568, start + SPIN_MS / 1000, 0.14, 0.45);
  }

  /** What the engine asked for. */
  play(effect: Extract<Effect, { type: "sound" }>): void {
    if (effect.sound === "spin") this.spin(effect.rows ?? 0);
    else if (effect.sound === "tick") this.tick();
    else if (effect.sound === "chime") this.chime(1);
    else this.chime(2);
  }
}
