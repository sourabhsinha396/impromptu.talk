/* What the round is set to, remembered in the browser under the same key
   v0 used, so a returning visitor keeps their genre and their lengths
   across the rebuild. v0 called the style "format"; that key is read once
   and written back as style. */

export const PREFS_KEY = "yapholic.prefs";
export const STAGE_KEY = "yapholic.staged";

export const SURPRISE = "surprise";

/* Whether the round listens, which is ours and is not the browser's
   permission. "ask" is nobody having decided yet and is the only state
   that draws the invitation; "off" is somebody who said no thanks, and it
   stays off until they change it in settings. We never call for the
   microphone under "ask", so the browser's own prompt can only ever
   appear because a person pressed a button that said it would. */
export type Mic = "ask" | "on" | "off";

export type Prefs = {
  genre: string;
  prep: number;
  speak: number;
  style: string;
  sound: boolean;
  mic: Mic;
  /** The report drawn to be filmed. Set once by somebody who points a
      phone at their screen, so it lives behind Additional settings and
      never on the front page of the sheet. */
  filming: boolean;
  /** Spin for pictures rather than sentences. A setting and not a control
      on the home stage: the stage is the genre chip, the question and one
      button, and the ten-second rule outranks putting a second axis on it
      (docs/DECISIONS.md, 2026-09-09). */
  pictures: boolean;
  /** How fast the scroller runs, in words a minute, on a warm-up. Speed is
      the difficulty on a read genre - the same passage is gentle at 120
      and brutal at 220 - so this is the one control those rounds have, and
      it is remembered because somebody who has found their speed should
      not have to find it again. */
  wpm: number;
  /** Which passages a warm-up hands you: a difficulty key, or Surprise me
      for no filter. Its own value rather than sharing `style`, because the
      two are different axes with different vocabularies, and a difficulty
      left in `style` would follow somebody back to home as a filter no
      genre there can match. */
  level: string;
  /** Which bank a warm-up draws from: a genre slug, or empty for the
      built-in one the page owns. Its own value rather than `genre`, which
      is what home opens on: choosing your own passages must not change
      the subject home hands you tomorrow. */
  passages: string;
};

export const DEFAULT_PREFS: Prefs = {
  genre: "general",
  prep: 60,
  speak: 60,
  style: SURPRISE,
  sound: true,
  mic: "ask",
  filming: false,
  pictures: false,
  wpm: 150,
  level: SURPRISE,
  passages: "",
};

/* The sliders' reach. Thinking may be none at all or up to half an hour (a
   long prep is how "deep research" is covered without a mode); talking is
   one to ten minutes. */
export const PREP_RANGE: [number, number] = [0, 1800];
export const SPEAK_RANGE: [number, number] = [60, 600];

/* The speeds the scroller offers, in words a minute. Four, because it is a
   segment and not a slider: a person picks the next one up when the last
   one stopped being hard, and a continuous dial would make that a fiddle
   rather than a press. 150 is an ordinary reading-aloud pace and is the
   default; 220 is the one worth filming. */
export const SPEEDS: readonly number[] = [120, 150, 180, 220];

/* The difficulties a warm-up offers, beside Surprise me. Both free, always:
   the hard ones are exactly the passages worth filming, so a gate on them
   would close the channel the feature exists to open (docs/DECISIONS.md). */
export const LEVELS: readonly string[] = ["easy", "hard"];

/* Whatever holds the prefs: localStorage in the browser, a Map in tests,
   null where storage is refused. Every read and write is wrapped, because
   storage can throw and a round must never depend on it. */
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function clamp(value: unknown, [low, high]: [number, number], fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(high, Math.max(low, n));
}

export function loadPrefs(store: Store | null): Prefs {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(store?.getItem(PREFS_KEY) ?? "{}") ?? {};
  } catch {
    saved = {};
  }
  const style = saved.style ?? saved.format;
  return {
    genre: typeof saved.genre === "string" && saved.genre ? saved.genre : DEFAULT_PREFS.genre,
    prep: clamp(saved.prep, PREP_RANGE, DEFAULT_PREFS.prep),
    speak: clamp(saved.speak, SPEAK_RANGE, DEFAULT_PREFS.speak),
    style: typeof style === "string" && style ? style : SURPRISE,
    /* v0 wrote 1 and 0; both are read, and a missing value means on. */
    sound: saved.sound === undefined ? true : Boolean(saved.sound),
    mic: saved.mic === "on" || saved.mic === "off" ? saved.mic : "ask",
    filming: saved.filming === true,
    pictures: saved.pictures === true,
    /* An unknown speed falls back rather than being clamped to the nearest:
       these are a fixed set with a validator in front of them, like the
       accent and the icon, and the one thing they must never be is
       whatever was in storage. */
    wpm: SPEEDS.includes(saved.wpm as number) ? (saved.wpm as number) : DEFAULT_PREFS.wpm,
    level: LEVELS.includes(saved.level as string) ? (saved.level as string) : SURPRISE,
    /* Checked against the bank on the way out, not here: a genre deleted
       since this was written must fall back to the page's own rather than
       leaving a round with nothing to draw. */
    passages: typeof saved.passages === "string" ? saved.passages : "",
  };
}

export function savePrefs(store: Store | null, prefs: Prefs): void {
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage refused; the round still runs on what is in memory. */
  }
}
