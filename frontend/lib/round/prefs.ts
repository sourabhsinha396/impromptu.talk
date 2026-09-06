/* What the round is set to, remembered in the browser under the same key
   v0 used, so a returning visitor keeps their genre and their lengths
   across the rebuild. v0 called the style "format"; that key is read once
   and written back as style. */

export const PREFS_KEY = "impromptu.prefs";
export const STAGE_KEY = "impromptu.staged";

export const SURPRISE = "surprise";

export type Prefs = { genre: string; prep: number; speak: number; style: string; sound: boolean };

export const DEFAULT_PREFS: Prefs = { genre: "general", prep: 60, speak: 60, style: SURPRISE, sound: true };

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
  };
}

export function savePrefs(store: Store | null, prefs: Prefs): void {
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage refused; the round still runs on what is in memory. */
  }
}
