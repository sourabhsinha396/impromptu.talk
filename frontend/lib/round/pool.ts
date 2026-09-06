import type { Bank, Topic } from "@/lib/bank";

import { STAGE_KEY, SURPRISE, type Prefs, type Store } from "@/lib/round/prefs";

export const REEL_DECOYS = 11;

/* What a spin may land on: the genre, narrowed by the style when that
   leaves anything. A filter that empties the bank is worse than a filter
   that is ignored, so an empty narrowing falls back to the genre, and an
   empty genre to the whole bank. */
export function pool(bank: Bank, prefs: Prefs): Topic[] {
  const all = bank.topics.filter((topic) => topic.genre === prefs.genre);
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
   the whole bank, and repeats itself before it ever gives up the spin. */
export function decoysFor(bank: Bank, prefs: Prefs, winner: Topic, random: () => number = Math.random): string[] {
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
