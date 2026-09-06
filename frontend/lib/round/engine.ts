import type { Bank, Topic } from "@/lib/bank";

import { clearStaged, decoysFor, draw, pool, settledStyle, stagedTopic, builtinStyles } from "@/lib/round/pool";
import {
  DEFAULT_PREFS,
  PREP_RANGE,
  SPEAK_RANGE,
  SURPRISE,
  loadPrefs,
  savePrefs,
  type Prefs,
  type Store,
} from "@/lib/round/prefs";
import { Timer } from "@/lib/round/timer";

/* The round, with no DOM in it: a topic you did not choose, a short prep,
   then a timed minute. The page renders whatever this says and hands back
   presses; sound, analytics and the write to the server hang off the
   effects it emits, so each of those can be absent without the round
   noticing.

   Six phases. Spin is the reel; the page tells the engine when the strip
   has settled (or the engine skips it under reduced motion). Prep and
   speak run the one timer. Done is what a finished round shows. */
export type Phase = "idle" | "spin" | "topic" | "prep" | "speak" | "done";

export const MAX_NOTE = 80;

export type RecordPayload = {
  topic_text: string;
  genre_slug: string;
  prep_seconds: number;
  speak_seconds: number;
  spoken_seconds: number;
  tz_offset: number;
};

export type Effect =
  /* The reel's clicks (rows tells the sound how many), the metronome while
     thinking, one chime into speaking, two when the minute is up. */
  | { type: "sound"; sound: "spin" | "tick" | "chime" | "chime2"; rows?: number }
  | { type: "track"; name: string; props: Record<string, unknown> }
  | { type: "record"; payload: RecordPayload };

export type EngineOptions = {
  bank: Bank;
  store: Store | null;
  random?: () => number;
  now?: () => number;
  /* prefers-reduced-motion: the spin is skipped and the topic just appears. */
  reduceMotion?: boolean;
  tzOffset?: () => number;
};

export type KeyContext = { typing: boolean; sheetOpen: boolean; modifier: boolean };

export class Engine {
  phase: Phase = "idle";
  topic: Topic | null = null;
  decoys: string[] = [];
  notes: string[] = ["", "", ""];
  spokeFor = 0;
  prefs: Prefs;
  readonly timer: Timer;
  readonly bank: Bank;

  private readonly store: Store | null;
  private readonly random: () => number;
  private readonly reduceMotion: boolean;
  private readonly tzOffset: () => number;
  private readonly used = new Set<string>();
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private readonly effects = new Set<(effect: Effect) => void>();

  constructor(options: EngineOptions) {
    this.bank = options.bank;
    this.store = options.store;
    this.random = options.random ?? Math.random;
    this.reduceMotion = options.reduceMotion ?? false;
    this.tzOffset = options.tzOffset ?? (() => -new Date().getTimezoneOffset());
    this.prefs = loadPrefs(this.store);
    if (!this.genre(this.prefs.genre)) this.prefs.genre = this.bank.genres[0]?.slug ?? DEFAULT_PREFS.genre;
    this.prefs.style = settledStyle(this.bank, this.prefs);
    this.timer = new Timer(
      {
        onTick: () => this.changed(),
        /* A metronome is useful while you are thinking and hostile while
           you are talking: a second voice in the room that lands in the
           recording. Prep only. */
        onSecond: () => {
          if (this.phase === "prep") this.effect({ type: "sound", sound: "tick" });
        },
      },
      options.now,
    );
  }

  /* For useSyncExternalStore: a version that moves on every change. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = (): number => this.version;

  onEffect(handler: (effect: Effect) => void): () => void {
    this.effects.add(handler);
    return () => this.effects.delete(handler);
  }

  private changed(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  private effect(effect: Effect): void {
    for (const handler of this.effects) handler(effect);
  }

  private track(name: string, props: Record<string, unknown> = {}): void {
    /* What the round was set to. Never the note text: those are the
       visitor's own words and have never left the browser. */
    this.effect({
      type: "track",
      name,
      props: {
        genre: this.prefs.genre,
        style: this.prefs.style,
        prep_seconds: this.prefs.prep,
        speak_seconds: this.prefs.speak,
        ...props,
      },
    });
  }

  genre(slug: string) {
    return this.bank.genres.find((genre) => genre.slug === slug);
  }

  get currentGenre() {
    return this.genre(this.prefs.genre) ?? this.bank.genres[0];
  }

  get filming(): boolean {
    return this.phase === "prep" || this.phase === "speak";
  }

  /* ------------------------------------------------------------ the round */

  spin(): void {
    this.track("spin_started");
    const staged = stagedTopic(this.store, this.bank);
    if (staged) {
      /* Consumed here rather than at load, so a reload before the first
         spin still lands where it was told to and the spin after does not. */
      clearStaged(this.store);
      this.topic = staged;
    } else {
      this.topic = draw(pool(this.bank, this.prefs), this.used, this.random) ?? null;
    }
    if (!this.topic) return;
    this.used.add(this.topic.text);
    this.notes = ["", "", ""];
    this.decoys = decoysFor(this.bank, this.prefs, this.topic, this.random);
    if (!this.decoys.length || this.reduceMotion) {
      this.showTopic();
      return;
    }
    this.phase = "spin";
    this.effect({ type: "sound", sound: "spin", rows: this.decoys.length });
    this.changed();
  }

  /** The strip has stopped, or the timeout that stands in for it fired. */
  settle(): void {
    if (this.phase === "spin") this.showTopic();
  }

  private showTopic(): void {
    this.phase = "topic";
    this.track("topic_shown", { topic_style: this.topic?.style });
    this.changed();
  }

  startPrep(): void {
    if (!this.topic) return;
    /* With no thinking time the button does not think: it starts the
       talking. */
    if (!this.prefs.prep) {
      this.startSpeak();
      return;
    }
    this.track("prep_started");
    this.phase = "prep";
    this.timer.start(this.prefs.prep, () => {
      this.effect({ type: "sound", sound: "chime" });
      this.startSpeak();
    });
    this.changed();
  }

  startSpeak(): void {
    if (!this.topic) return;
    this.track("speak_started");
    this.phase = "speak";
    this.timer.start(this.prefs.speak, () => {
      this.effect({ type: "sound", sound: "chime2" });
      this.finish(this.prefs.speak);
    });
    this.changed();
  }

  togglePause(): void {
    if (!this.timer.running) return;
    if (this.timer.paused) this.timer.resume();
    else this.timer.pause();
    this.changed();
  }

  /** Done: stop early and still record it. Finishing early is data, not a
      failure, and the gap between what someone set and what they spoke
      for is the most honest signal about whether the length is right. */
  done(): void {
    if (this.phase !== "speak") return;
    this.finish(this.timer.elapsedSeconds);
  }

  private finish(seconds: number): void {
    this.timer.stop();
    this.spokeFor = seconds;
    this.phase = "done";
    this.track("round_finished", {
      spoken_seconds: seconds,
      finished_early: seconds < this.prefs.speak,
      notes_written: this.notes.filter((note) => note.trim()).length,
    });
    if (this.topic) {
      this.effect({
        type: "record",
        payload: {
          topic_text: this.topic.text,
          genre_slug: this.prefs.genre,
          prep_seconds: this.prefs.prep,
          speak_seconds: this.prefs.speak,
          spoken_seconds: seconds,
          tz_offset: this.tzOffset(),
        },
      });
    }
    this.changed();
  }

  /** Reset from thinking or speaking: leave and keep nothing, one step
      back to the topic. The topic and the notes survive and the chrome
      comes back with them. In speak this is the whole difference from
      Done beside it: Done records, this does not. */
  leaveRound(): void {
    if (!this.filming) return;
    this.track("round_left", {
      left_from: this.phase,
      spoken_seconds: this.phase === "speak" ? this.timer.elapsedSeconds : 0,
    });
    this.timer.stop();
    this.phase = "topic";
    this.changed();
  }

  /** Reset from the topic: back to the start. The topic is dropped so the
      next spin cannot settle on what was just refused, and the chip and
      the gear are reachable again. */
  resetToIdle(): void {
    if (this.phase !== "topic") return;
    this.track("round_left", { left_from: "topic", spoken_seconds: 0 });
    this.topic = null;
    this.notes = ["", "", ""];
    this.phase = "idle";
    this.changed();
  }

  /** Same topic again, from done: a retake for the people who film. */
  sameTopic(): void {
    if (this.phase !== "done" || !this.topic) return;
    this.notes = ["", "", ""];
    this.showTopic();
  }

  setNote(index: number, text: string): void {
    if (index < 0 || index > 2) return;
    this.notes = this.notes.map((note, i) => (i === index ? text.slice(0, MAX_NOTE) : note));
    this.changed();
  }

  /* ------------------------------------------------------------ settings */

  chooseGenre(slug: string): void {
    if (!this.genre(slug)) return;
    this.prefs.genre = slug;
    this.used.clear();
    this.prefs.style = settledStyle(this.bank, this.prefs);
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "genre_chosen", props: { genre: slug } });
    this.changed();
  }

  chooseStyle(key: string): void {
    this.prefs.style = key;
    this.used.clear();
    savePrefs(this.store, this.prefs);
    /* A coined style is somebody's own words, so the name never leaves the
       browser; what is worth counting is that the axis was used at all. */
    this.effect({
      type: "track",
      name: "style_chosen",
      props: { style: builtinStyles(this.bank).has(key) ? key : "custom" },
    });
    this.changed();
  }

  setLength(which: "prep" | "speak", seconds: number): void {
    const [low, high] = which === "prep" ? PREP_RANGE : SPEAK_RANGE;
    this.prefs[which] = Math.min(high, Math.max(low, Math.round(seconds)));
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "length_changed", props: { setting: which, seconds: this.prefs[which] } });
    this.changed();
  }

  setSound(on: boolean): void {
    this.prefs.sound = on;
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "sound_toggled", props: { on } });
    this.changed();
  }

  /* ------------------------------------------------------------ keyboard */

  /** Space starts and pauses, N asks for another topic, Escape resets.
      Returns whether the key was taken, so the caller can prevent the
      default. Escape is read before the typing guard, because prep is the
      phase where somebody is typing notes and the key that leaves it has
      to work from inside one; a sheet still wins. N is dead mid-round: the
      only way to a new topic while the clock runs is to stop. */
  key(code: string, context: KeyContext): boolean {
    if (context.sheetOpen) return false;
    if (code === "Escape") {
      if (this.filming) {
        this.leaveRound();
        return true;
      }
      if (this.phase === "topic") {
        this.resetToIdle();
        return true;
      }
      return false;
    }
    if (context.typing || context.modifier) return false;
    if (code === "Space") {
      if (this.phase === "idle" || this.phase === "done") this.spin();
      else if (this.phase === "topic") this.startPrep();
      else if (this.filming) this.togglePause();
      else return false;
      return true;
    }
    if (code === "KeyN" && (this.phase === "idle" || this.phase === "topic" || this.phase === "done")) {
      this.spin();
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ arrival */

  /** What the address bar asked for. `?genre=` moves the picker and is
      remembered; `?topic=<slug>` shows that topic and skips the reel,
      because you already know what you clicked; a staged topic moves the
      genre before first paint so the chip, the decoys and the record all
      name the same genre. Returns whether the address bar should be
      cleaned: a link somebody copies from here should be the site, not
      the person who sent them. */
  arrive(params: URLSearchParams): boolean {
    const wantGenre = params.get("genre");
    const wantTopic = params.get("topic");
    if (wantGenre && this.genre(wantGenre)) {
      this.prefs.genre = wantGenre;
      this.prefs.style = settledStyle(this.bank, this.prefs);
      savePrefs(this.store, this.prefs);
    }
    const staged = wantTopic ? null : stagedTopic(this.store, this.bank);
    if (staged) this.prefs.genre = staged.genre;
    if (wantTopic) {
      const hit = this.bank.topics.find((topic) => topic.slug === wantTopic);
      if (hit) {
        this.topic = hit;
        this.used.add(hit.text);
        this.prefs.genre = hit.genre;
        this.prefs.style = settledStyle(this.bank, this.prefs);
        this.showTopic();
      }
    }
    this.changed();
    return Boolean(wantGenre || wantTopic || params.has("ref"));
  }
}

export { SURPRISE };
