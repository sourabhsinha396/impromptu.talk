/* The countdown. Wall-clock, never tick-counted: the end is a moment on
   the clock and every loop reads how far off it is, so a throttled
   background tab that fires the loop late cannot gift extra time. Pause
   stops the reading; resume moves the end forward by what was left. */

export type TimerHooks = {
  /* Every loop, for the ring and the digits. */
  onTick?: (timer: Timer) => void;
  /* Once per whole second crossed, with the seconds now left; the
     metronome hangs off this and the engine decides whether to sound it. */
  onSecond?: (secondsLeft: number) => void;
};

export class Timer {
  total = 0;
  left = 0;
  endAt = 0;
  running = false;
  paused = false;
  private id: ReturnType<typeof setInterval> | null = null;
  private onDone: (() => void) | null = null;

  constructor(
    private readonly hooks: TimerHooks = {},
    private readonly now: () => number = Date.now,
  ) {}

  start(seconds: number, onDone: () => void): void {
    this.stop();
    this.total = seconds * 1000;
    this.left = this.total;
    this.endAt = this.now() + this.total;
    this.onDone = onDone;
    this.running = true;
    this.paused = false;
    this.id = setInterval(() => this.loop(), 100);
    this.loop();
  }

  private loop(): void {
    if (!this.running || this.paused) return;
    const before = Math.ceil(this.left / 1000);
    this.left = Math.max(0, this.endAt - this.now());
    const after = Math.ceil(this.left / 1000);
    this.hooks.onTick?.(this);
    if (after !== before && after > 0) this.hooks.onSecond?.(after);
    if (this.left <= 0) {
      this.running = false;
      this.clear();
      const done = this.onDone;
      this.onDone = null;
      done?.();
    }
  }

  pause(): void {
    if (this.running) this.paused = true;
  }

  resume(): void {
    if (!this.running) return;
    this.endAt = this.now() + this.left;
    this.paused = false;
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.onDone = null;
    this.clear();
  }

  private clear(): void {
    if (this.id !== null) clearInterval(this.id);
    this.id = null;
  }

  /** Whole seconds spoken so far: what Done records. */
  get elapsedSeconds(): number {
    return Math.round((this.total - this.left) / 1000);
  }

  /** 0 to 1, how much of the round is still to come. */
  get fraction(): number {
    return this.total ? Math.max(0, Math.min(1, this.left / this.total)) : 0;
  }

  /** "1:00", "0:07": what the clock prints. */
  get text(): string {
    const s = Math.max(0, Math.ceil(this.left / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  /** The last ten seconds, when the ring turns warm. */
  get ending(): boolean {
    return this.running && this.left > 0 && this.left <= 10_000;
  }
}
