import { isRead, type Bank, type Topic } from "@/lib/bank";

import { STAGE_KEY, SURPRISE, type Prefs, type Store } from "@/lib/round/prefs";

export const REEL_DECOYS = 11;

function hasImage(topic: Topic): boolean {
  return Boolean(topic.image);
}

/* What a spin may land on: the genre, narrowed by the style when that
   leaves anything. A filter that empties the bank is worse than a filter
   that is ignored, so an empty narrowing falls back to the genre, and an
   empty genre to the whole bank.

   Picture mode is the one narrowing that never falls back to a sentence.
   The others are preferences and a round is still a round without them;
   this one is a promise about what the next screen holds, and answering
   it with a topic that has no picture is the mode silently not working.
   So it prefers the genre's pictures, then any picture in the bank, and
   only a bank holding none at all gives way. */
export function pool(bank: Bank, prefs: Prefs): Topic[] {
  const all = bank.topics.filter((topic) => topic.genre === prefs.genre);
  /* A warm-up never falls back to a sentence, for the reason picture mode
     never does: the fallbacks below exist so a *preference* cannot empty
     the bank, and this is not a preference but a promise about the next
     screen. Its passages are fetched rather than shipped, so the honest
     answer before they land is nothing at all - handing back a one-line
     prompt to be read off a scroller is the mode silently not working. */
  if (isRead(bank.genres.find((genre) => genre.slug === prefs.genre))) {
    /* Difficulty narrows a warm-up the way style narrows a genre, and it
       falls back the same way: a filter that empties the bank is worse
       than one that is ignored. */
    if (prefs.level !== SURPRISE) {
      const narrowed = all.filter((topic) => topic.level === prefs.level);
      if (narrowed.length) return narrowed;
    }
    return all;
  }
  if (prefs.pictures) {
    const here = all.filter(hasImage);
    if (here.length) return here;
    const anywhere = bank.topics.filter(hasImage);
    if (anywhere.length) return anywhere;
  }
  if (prefs.style !== SURPRISE) {
    const narrowed = all.filter((topic) => topic.style === prefs.style);
    if (narrowed.length) return narrowed;
  }
  return all.length ? all : bank.topics;
}

/* One topic that has not come up since the pool last ran dry. A shuffle
   that hands back the topic you just skipped reads as broken. */
export function draw(source: Topic[], used: Set<string>, random: () => number = Math.random): Topic | undefined {
  let fresh = source.filter((topic) => !used.has(topic.text));
  if (!fresh.length) {
    used.clear();
    fresh = source;
  }
  return fresh[Math.floor(random() * fresh.length)];
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* Decoys are pure theatre, so a thin filter borrows from the genre, then
   the whole bank, and repeats itself before it ever gives up the spin.

   A picture round spins too, on the same count: the page swaps the strip
   of sentences for a strip of skeletons and lands on the photograph. The
   spin is the moment of no take-backs and the most filmable thing on the
   site, and a picture round that skipped it felt like a different, lesser
   product. Only the rows differ, never the timing. */
export function decoysFor(bank: Bank, prefs: Prefs, winner: Topic, random: () => number = Math.random): string[] {
  /* A warm-up does not spin. The reel is a strip of one-line prompts
     rolling to a stop, and landing that on a 120-word passage promises
     the wrong kind of answer - the same mismatch a photograph had, and
     the fix there was to change what rolls. Nothing rolls here yet, and
     no decoys is already a path the engine takes: it shows the passage
     directly. The moment of no take-backs on a warm-up is the Start
     press, which the passage screen already is. */
  if (isRead(bank.genres.find((genre) => genre.slug === prefs.genre))) return [];
  const seen = new Set([winner.text]);
  let out: string[] = [];
  const tiers = [pool(bank, prefs), bank.topics.filter((topic) => topic.genre === prefs.genre), bank.topics];
  for (const tier of tiers) {
    if (out.length >= REEL_DECOYS) break;
    for (const topic of shuffled(tier, random)) {
      if (!seen.has(topic.text)) {
        seen.add(topic.text);
        out.push(topic.text);
      }
    }
  }
  out = out.slice(0, REEL_DECOYS);
  while (out.length && out.length < REEL_DECOYS) out = out.concat(out).slice(0, REEL_DECOYS);
  return out;
}

/* A topic rigged from the operator console, in this browser and for one
   spin. The key is the genre and the words, not a slug, because an owned
   genre's topic may share a sentence with another. Looked up in the bank
   rather than trusted: a name that matches nothing is a random topic, not
   a broken round. Peeked here, consumed by the draw. */
export function stagedTopic(store: Store | null, bank: Bank): Topic | null {
  let want: { g?: string; t?: string } | null = null;
  try {
    want = JSON.parse(store?.getItem(STAGE_KEY) ?? "null");
  } catch {
    return null;
  }
  if (!want?.g || !want.t) return null;
  return bank.topics.find((topic) => topic.genre === want.g && topic.text === want.t) ?? null;
}

export function clearStaged(store: Store | null): void {
  try {
    store?.removeItem(STAGE_KEY);
  } catch {
    /* Nothing to do; the next draw simply lands there again. */
  }
}

export function builtinStyles(bank: Bank): Set<string> {
  return new Set(bank.styles.map((style) => style.key));
}

/* The styles a genre's own topics were tagged with beyond the built-ins:
   what an owned genre coined. A filter you cannot select is a tag that may
   as well not exist. */
export function ownStyles(bank: Bank, genre: string): string[] {
  const builtin = builtinStyles(bank);
  const found = new Set<string>();
  for (const topic of bank.topics) {
    if (topic.genre === genre && topic.style && !builtin.has(topic.style)) found.add(topic.style);
  }
  return [...found].sort();
}

/* A coined style belongs to the genre that coined it. Carried into a
   genre that has never heard of it, it would leave a filter selected that
   nothing can match, so it goes back to Surprise me. Built-ins survive
   the move. */
export function settledStyle(bank: Bank, prefs: Prefs): string {
  if (prefs.style === SURPRISE || builtinStyles(bank).has(prefs.style)) return prefs.style;
  return ownStyles(bank, prefs.genre).includes(prefs.style) ? prefs.style : SURPRISE;
}
