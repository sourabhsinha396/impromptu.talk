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
};

export const DEFAULT_PREFS: Prefs = {
  genre: "general",
  prep: 60,
  speak: 60,
  style: SURPRISE,
  sound: true,
  mic: "ask",
  filming: false,
};

/* The sliders' reach. Thinking may be none at all or up to half an hour (a
   long prep is how "deep research" is covered without a mode); talking is
   one to ten minutes. */
export const PREP_RANGE: [number, number] = [0, 1800];
export const SPEAK_RANGE: [number, number] = [60, 600];

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
  };
}

export function savePrefs(store: Store | null, prefs: Prefs): void {
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage refused; the round still runs on what is in memory. */
  }
}
