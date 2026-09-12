import type { Store } from "@/lib/round/prefs";

/* The fastest speed a passage has been read at, per passage, in this
   browser.

   Not a run and not a row. A warm-up does not build the streak (a
   45-second read is not a minute of unscripted speaking, and letting it
   count would make the streak mean something weaker), so there is nothing
   to POST and nothing on the server to read back. What is left is a number
   that makes the next press worth making, and that belongs in the browser
   beside the prefs.

   Nothing here is trusted: the site cannot hear whether somebody kept up,
   so this records what they attempted, and the done screen says as much
   rather than claiming they succeeded. */
export const WARMUPS_KEY = "yapholic.warmups";

type Bests = Record<string, number>;

export function loadBests(store: Store | null): Bests {
  try {
    const saved: unknown = JSON.parse(store?.getItem(WARMUPS_KEY) ?? "{}");
    if (!saved || typeof saved !== "object") return {};
    const out: Bests = {};
    for (const [slug, value] of Object.entries(saved as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) out[slug] = Math.round(value);
    }
    return out;
  } catch {
    return {};
  }
}

/** The new best, which is the old one unless this attempt beat it. */
export function recordBest(store: Store | null, slug: string, wpm: number): number {
  const bests = loadBests(store);
  const best = Math.max(bests[slug] ?? 0, wpm);
  bests[slug] = best;
  try {
    store?.setItem(WARMUPS_KEY, JSON.stringify(bests));
  } catch {
    /* Storage refused; the number still shows for this attempt. */
  }
  return best;
}

/** How long a passage takes at a speed, in seconds. Arithmetic rather than
    a stored duration: the words are known and the speed is picked, so a
    number in a column could only ever disagree with them. */
export function readSeconds(words: number, wpm: number): number {
  return wpm > 0 ? (words / wpm) * 60 : 0;
}

/** "About 46 seconds", as the passage screen says it before you start, so
    somebody about to record knows how long the clip will run. */
export function readLength(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} seconds`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (!rest) return minutes === 1 ? "a minute" : `${minutes} minutes`;
  return `${minutes} min ${rest}s`;
}

/* A word long enough to be worth sizing. Purely an optimisation: the rule
   below hands anything that already fits its full size, so this only
   decides how many words are drawn with a style of their own. */
export const LONG_WORD = 14;

/* How wide a character of the display face is, in ems, at its widest.
   Measured across the longest words in the bank - 0.343 to 0.427 depending
   on which letters - and the ceiling is taken, because an overflow runs
   off the side of the screen and a few percent of unused size is
   invisible. Measured at 88% of the column for the worst word in the bank.

   Character count rather than a measured width, deliberately: it needs no
   layout pass, so it cannot race the font loading or flash an overflowing
   frame, and it follows a resize for free. */
export const CHAR_EM = 0.46;

/** The size a word takes so it fits the column it is in, or undefined when
    it already fits and should be left alone.

    This is what stops "pneumonoultramicroscopicsilicovolcanoconiosis" from
    running off the side of the scroller. The word is the whole point of
    the passage it belongs to, so it is not broken across lines and not
    dropped from the bank: it takes a size of its own and stays one
    readable unit, which is what somebody has to say it as. Everything
    shorter is untouched, so a passage with no monsters in it is drawn
    exactly as it was.

    `cqw` is a percentage of the reading column, so the answer follows the
    column rather than the viewport, and `min` with 1em means a word that
    fits keeps the passage's own size. */
export function longWordSize(word: string): string | undefined {
  if (word.length <= LONG_WORD) return undefined;
  return `min(1em, calc(100cqw / ${(word.length * CHAR_EM).toFixed(2)}))`;
}
