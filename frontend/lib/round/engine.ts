import { isRead, type Bank, type Topic } from "@/lib/bank";

import { clearStaged, decoysFor, draw, pool, settledStyle, stagedTopic, builtinStyles } from "@/lib/round/pool";
import { loadBests, readSeconds, recordBest } from "@/lib/round/warmups";
import {
  DEFAULT_PREFS,
  LEVELS,
  PREP_RANGE,
  SPEAK_RANGE,
  SPEEDS,
  SURPRISE,
  loadPrefs,
  savePrefs,
  type Mic,
  type Prefs,
  type Store,
} from "@/lib/round/prefs";
import { Timer } from "@/lib/round/timer";

/* The round, with no DOM in it: a topic you did not choose, a short prep,
   then a timed minute. The page renders whatever this says and hands back
   presses; sound, analytics and the write to the server hang off the
   effects it emits, so each of those can be absent without the round
   noticing.

   Six phases for a speak genre. Spin is the reel; the page tells the
   engine when the strip has settled (or the engine skips it under reduced
   motion). Prep and speak run the one timer. Done is what a finished round
   shows.

   A warm-up (a genre whose mode is read) takes a different middle: topic
   is the passage with its speed, then a three-second lead-in so somebody
   who just pressed record can get ready, then the scroll. There is no prep
   (nothing to think about) and no clock (the scroll is the timer), and
   nothing is written to the server, because a warm-up does not build the
   streak. Everything either side of that middle - the pool, the deep link,
   the picker, camera mode - is untouched. */
export type Phase = "idle" | "spin" | "topic" | "prep" | "speak" | "ready" | "reading" | "done";

/** The lead-in before the words start moving. Three seconds is what it
    takes to press record, sit back and find the camera; without it the
    first line of every recording is somebody reaching for the mouse. */
export const LEAD_IN = 3;

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
  /** A feature page fixes its own genre: `/tongue-twisters` is always the
      tongue twisters, and the picker is not offered there. Held apart from
      `prefs.genre` on purpose - that is the genre home opens on, and an
      hour of warm-ups must not quietly become somebody's default topic. */
  lockedGenre?: string;
  /** The passage a feature page opened on, chosen by the server so the
      first paint is already the tool. Without it the page would render its
      landing screen, mount, and spin a frame later, which is a flash on
      every visit. Overridden by `?topic=` when a link names one. */
  initialTopic?: string;
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
  /** The best speed this passage has been read at in this browser, filled
      in when a read finishes so the done screen can say it. */
  best = 0;
  readonly timer: Timer;
  readonly bank: Bank;

  private readonly store: Store | null;
  private readonly random: () => number;
  private readonly reduceMotion: boolean;
  private readonly lockedGenre: string | null;
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
    this.lockedGenre = options.lockedGenre ?? null;
    this.tzOffset = options.tzOffset ?? (() => -new Date().getTimezoneOffset());
    this.prefs = loadPrefs(this.store);
    /* Only home settles the remembered genre and style against the bank.
       A feature page's bank holds one genre - its own - so doing it here
       would find "career" missing and rewrite it to the feature every
       time somebody opened the page, which is the leak the lock exists to
       stop. Locked, these two are left exactly as they were found. */
    if (!this.lockedGenre) {
      /* A remembered warm-up is rewritten here as though it were missing,
         because at home it may as well be. Its passages are deliberately
         not in home's bank - they are fetched on the page that runs them -
         so `pool` correctly hands back nothing and Spin waits for rows
         that will never arrive. Existing in the bank was the whole of the
         old check, and a warm-up does exist there: the picker lists it. So
         a pref naming one left somebody with a home screen whose only
         button did nothing, on every visit, with no way back except
         picking another genre they had no reason to think was the
         problem. The fallback skips warm-ups too, or a bank that ever
         sorted one first would land straight back here. */
      const remembered = this.genre(this.prefs.genre);
      if (!remembered || isRead(remembered)) {
        this.prefs.genre = this.bank.genres.find((genre) => !isRead(genre))?.slug ?? DEFAULT_PREFS.genre;
      }
      this.prefs.style = settledStyle(this.bank, this.prefs);
    }
    /* Opened on a topic rather than on idle, which is what lets a feature
       page be the tool the moment it loads. Set before the timer so the
       first snapshot the page reads is already the topic phase. */
    if (options.initialTopic) {
      const hit = this.bank.topics.find((topic) => topic.slug === options.initialTopic);
      if (hit) {
        this.topic = hit;
        this.used.add(hit.text);
        this.phase = "topic";
      }
    }
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
        genre: this.activeGenre,
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

  /** The genre in play: the one this page is locked to, or the remembered
      one. Everything that draws reads this; only the picker writes
      `prefs.genre`. */
  get activeGenre(): string {
    if (!this.lockedGenre) return this.prefs.genre;
    /* A warm-up page draws from the bank the visitor chose, which is the
       page's own unless they picked one of theirs. Checked against what
       is actually here rather than trusted: a genre they deleted since,
       or one a lapsed account no longer loads, must fall back to the
       page's own rather than leaving a round with nothing to draw. */
    const chosen = this.prefs.passages;
    return chosen && isRead(this.genre(chosen)) ? chosen : this.lockedGenre;
  }

  /** Every bank this page can draw from: its own first, then the
      visitor's. Empty on home, which picks a genre instead. */
  get sources() {
    if (!this.lockedGenre) return [];
    return this.bank.genres.filter((genre) => isRead(genre));
  }

  /** Whether the genre is fixed by the page, so no picker is offered. */
  get locked(): boolean {
    return this.lockedGenre !== null;
  }

  /** What the pool and the decoys read: the prefs with the genre in play,
      so a locked page draws from its own genre without that genre ever
      being written back as the visitor's default. */
  private get drawing(): Prefs {
    return this.lockedGenre ? { ...this.prefs, genre: this.lockedGenre } : this.prefs;
  }

  get currentGenre() {
    return this.genre(this.activeGenre) ?? this.bank.genres[0];
  }

  get filming(): boolean {
    return this.phase === "prep" || this.phase === "speak" || this.phase === "ready" || this.phase === "reading";
  }

  /** Whether the genre in play is a warm-up: read aloud off the scroller
      rather than talked about. The one branch the round takes. */
  get reading(): boolean {
    return this.currentGenre?.mode === "read";
  }

  /** The lead-in's digit, 3 down to 1. Read off the timer rather than
      stored, for the reason the streak gives at length: a second copy of a
      number drifts the first moment something surprises it. */
  get leadIn(): number {
    return Math.max(1, Math.ceil(this.timer.left / 1000));
  }

  /** The words in the passage on screen. Counted rather than stored: the
      text is here, and a column could only ever disagree with it. */
  get words(): number {
    return this.topic ? this.topic.text.trim().split(/\s+/).length : 0;
  }

  /** How long this passage runs at the chosen speed, in seconds. */
  get readSeconds(): number {
    return readSeconds(this.words, this.prefs.wpm);
  }

  /** One exact topic, from a link. */
  private openTopic(hit: Topic): void {
    this.topic = hit;
    this.used.add(hit.text);
    if (!this.locked) {
      this.prefs.genre = hit.genre;
      this.prefs.style = settledStyle(this.bank, this.prefs);
    }
    this.showTopic();
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
      this.topic = draw(pool(this.bank, this.drawing), this.used, this.random) ?? null;
    }
    if (!this.topic) return;
    this.used.add(this.topic.text);
    this.notes = ["", "", ""];
    this.decoys = decoysFor(this.bank, this.drawing, this.topic, this.random);
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
    /* One key per axis, as the rows carry them: a passage has no style and
       reporting its level as one made two vocabularies share a column in
       the analytics after they had stopped sharing one in the table. */
    this.track("topic_shown", {
      topic_style: this.topic?.style,
      topic_level: this.topic?.level,
      picture: Boolean(this.topic?.image),
    });
    this.changed();
  }

  startPrep(): void {
    if (!this.topic) return;
    /* A warm-up has nothing to think about: the words are on the screen
       and the whole task is keeping up with them. The primary button on
       that screen starts the lead-in instead. */
    if (this.reading) {
      this.startReading();
      return;
    }
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

  /* ------------------------------------------------------------ warm-ups */

  /** The lead-in, then the scroll. Two timers rather than one, because the
      digits and the words move at different rates and the page has to know
      which it is drawing. */
  startReading(): void {
    if (!this.topic || !this.reading) return;
    this.track("warmup_started", { wpm: this.prefs.wpm, words: this.words });
    this.phase = "ready";
    this.timer.start(LEAD_IN, () => this.scroll());
    this.changed();
  }

  private scroll(): void {
    this.effect({ type: "sound", sound: "chime" });
    this.phase = "reading";
    /* The page animates the words with one linear transform over this
       many seconds, rather than moving them frame by frame off a tick:
       a transition the compositor owns cannot stutter, and the round
       already knows exactly how long it should take. This timer only
       decides when it is over. */
    this.timer.start(this.readSeconds, () => this.finishReading());
    this.changed();
  }

  /** Stop early, or the scroll reached the end. Either way nothing is
      written to the server: a warm-up does not build the streak, so there
      is no run to record and no summary to show. What is kept is the
      speed, in this browser, because that is what makes the next press
      worth making. */
  finishReading(): void {
    if (this.phase !== "reading" && this.phase !== "ready") return;
    const finished = this.phase === "reading" && this.timer.elapsedSeconds >= this.readSeconds - 1;
    this.timer.stop();
    if (finished) {
      this.effect({ type: "sound", sound: "chime2" });
      this.best = this.topic ? recordBest(this.store, this.topic.slug, this.prefs.wpm) : 0;
    } else {
      this.best = this.topic ? (loadBests(this.store)[this.topic.slug] ?? 0) : 0;
    }
    this.track("warmup_finished", { wpm: this.prefs.wpm, words: this.words, finished_early: !finished });
    this.phase = "done";
    this.changed();
  }

  /** The next speed up, from the done screen. The loop on a warm-up is
      repetition rather than variety - you go again in two seconds to beat
      your own number - so this is the primary button there, which is the
      reverse of the round's done screen. At the top speed it simply goes
      again at the top speed. */
  againFaster(): void {
    if (this.phase !== "done" || !this.topic) return;
    const next = SPEEDS[Math.min(SPEEDS.indexOf(this.prefs.wpm) + 1, SPEEDS.length - 1)];
    if (next && next !== this.prefs.wpm) this.setSpeed(next);
    this.showTopic();
  }

  /** Which passages a warm-up hands you. The no-repeat pool is cleared with
      it, as choosing a genre or a style does: the two levels are different
      halves of the bank. */
  setLevel(level: string): void {
    if (level !== SURPRISE && !LEVELS.includes(level)) return;
    this.prefs.level = level;
    this.used.clear();
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "level_chosen", props: { level } });
    this.changed();
  }

  /** Which bank a warm-up draws from. Cleared to the page's own when the
      slug names nothing here. The no-repeat pool is cleared with it, as
      choosing a genre does: two banks are two different sets of rows. */
  setSource(slug: string): void {
    const wanted = slug && isRead(this.genre(slug)) ? slug : "";
    this.prefs.passages = wanted;
    this.used.clear();
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "passages_chosen", props: { own: Boolean(wanted) } });
    this.spin();
  }

  setSpeed(wpm: number): void {
    if (!SPEEDS.includes(wpm)) return;
    this.prefs.wpm = wpm;
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "speed_chosen", props: { wpm } });
    this.changed();
  }

  togglePause(): void {
    /* A read does not pause. The words move on a transition the compositor
       owns and the clock is a separate timer, so pausing one stopped the
       other dead and the round finished after the passage had already
       scrolled past. Rather than teach the two to stop together for a
       control nobody needs - an interrupted recording is restarted, not
       resumed - the read simply has no pause, and Stop is the way out. */
    if (this.reading) return;
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
          genre_slug: this.activeGenre,
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
    if (this.phase === "ready" || this.phase === "reading") {
      this.timer.stop();
      this.track("round_left", { left_from: this.phase, spoken_seconds: 0 });
      this.phase = "topic";
      this.changed();
      return;
    }
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
    /* A feature page never shows idle - it opens on the tool - so the way
       out of a passage is another passage, not an empty screen. */
    if (this.locked) {
      this.spin();
      return;
    }
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
    const wanted = this.genre(slug);
    /* A warm-up is not selectable here: it is a page, and its bank does
       not ship with home, so picking one would leave a genre chip naming
       a genre this round can never draw from. */
    if (this.locked || !wanted || isRead(wanted)) return;
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

  /** The thumb is moving: the headline and the button follow it, and
      nothing is written or counted until it is let go. */
  previewLength(which: "prep" | "speak", seconds: number): void {
    const [low, high] = which === "prep" ? PREP_RANGE : SPEAK_RANGE;
    this.prefs[which] = Math.min(high, Math.max(low, Math.round(seconds)));
    this.changed();
  }

  setLength(which: "prep" | "speak", seconds: number): void {
    const [low, high] = which === "prep" ? PREP_RANGE : SPEAK_RANGE;
    this.prefs[which] = Math.min(high, Math.max(low, Math.round(seconds)));
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "length_changed", props: { setting: which, seconds: this.prefs[which] } });
    this.changed();
  }

  /** Turning the report on or off. Never opens the microphone itself:
      the page does that, inside the press, so the browser's prompt is
      always something a person asked for. */
  setMic(mic: Mic): void {
    this.prefs.mic = mic;
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "mic_set", props: { mic } });
    this.changed();
  }

  /** The report drawn to be filmed, or the reading one. Only the drawing
      changes: the round, what is measured and what is stored are the
      same either way. */
  setFilming(on: boolean): void {
    this.prefs.filming = on;
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "filming_toggled", props: { on } });
    this.changed();
  }

  setSound(on: boolean): void {
    this.prefs.sound = on;
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "sound_toggled", props: { on } });
    this.changed();
  }

  /** Spin for pictures rather than sentences. The no-repeat pool is
      cleared with it, as choosing a genre or a style does: the two modes
      draw from different halves of the bank, and carrying the sentences
      you have already seen into a mode that cannot land on them only
      makes the next picture pool run dry sooner. */
  setPictures(on: boolean): void {
    this.prefs.pictures = on;
    this.used.clear();
    savePrefs(this.store, this.prefs);
    this.effect({ type: "track", name: "pictures_toggled", props: { on } });
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
      /* A read has no pause, so space does not claim the key either: a
         handled key is one this preventDefaults, and swallowing it to do
         nothing is worse than leaving it alone. */
      else if (this.reading) return false;
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
    /* `?pictures=1` turns the mode on and remembers it, which is how
       /features opens it: the home stage carries no control for it, so a
       link is the one way in that costs the stage nothing. `=0` is the
       way back out, so the link is reversible by hand. */
    const wantPictures = params.get("pictures");
    /* The speed a challenge link carries: "I did this at 180, you try". One
       of four known values or it is ignored, like every other thing a
       stranger can put in the address bar. */
    const wantWpm = Number(params.get("wpm"));
    if (SPEEDS.includes(wantWpm)) {
      this.prefs.wpm = wantWpm;
      savePrefs(this.store, this.prefs);
    }
    if (wantPictures !== null) {
      this.prefs.pictures = wantPictures !== "0";
      savePrefs(this.store, this.prefs);
    }
    /* A read genre named in a link is refused here as it is in the
       picker: home cannot draw from one, and the redirect that catches a
       built-in warm-up cannot see an owned one, which lives behind the
       cookie rather than in the public bank. */
    if (wantGenre && !this.locked && this.genre(wantGenre) && !isRead(this.genre(wantGenre))) {
      this.prefs.genre = wantGenre;
      this.prefs.style = settledStyle(this.bank, this.prefs);
      savePrefs(this.store, this.prefs);
    }
    const staged = wantTopic ? null : stagedTopic(this.store, this.bank);
    if (staged) this.prefs.genre = staged.genre;
    if (wantTopic) {
      const hit = this.bank.topics.find((topic) => topic.slug === wantTopic);
      /* A slug this page's bank does not hold names nothing here, and the
         visitor gets the ordinary idle screen. Each feature's bank ships
         with its own page, so a passage link is only ever opened by the
         page that owns it. */
      if (hit) this.openTopic(hit);
    }
    this.changed();
    return Boolean(wantGenre || wantTopic || wantPictures !== null || params.has("wpm") || params.has("ref"));
  }
}

export { SURPRISE };
