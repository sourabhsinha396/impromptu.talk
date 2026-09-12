/* The bank as the page receives it, and nothing that fetches it.

   This module is imported for its *values* by client components (the
   picker asks whether a genre is a warm-up), so it must not reach
   `lib/api.ts`: that imports `next/headers`, and a client component
   pulling it in stops the build outright with "next/headers ... in the
   Pages Router". The fetchers live in `lib/api.ts` with every other
   server-only call, which is the split `lib/owned.ts` already made
   (docs/DECISIONS.md, 2026-09-09).

   The bank as the page receives it: the built-in genres in picker order,
   every active topic, and the styles for the select. One shape for the
   picker, the reel and the style select. */
/* `mode` is absent on the ten and on anything somebody owns, and "read" on
   a warm-up: a genre whose topics are passages read aloud off a scroller
   rather than prompts to talk about. Absent rather than "speak" on every
   row, for the reason `Topic.image` gives below. */
export type Genre = { slug: string; name: string; icon: string; blurb: string; own?: boolean; mode?: "read" };

export const READ = "read";

/** Whether this genre is a warm-up: read aloud, no prep, no clock. */
export function isRead(genre: Genre | undefined): boolean {
  return genre?.mode === READ;
}

/** Where a feature lives. One URL per feature, named by its slug: home is
    the tool and keeps the genre chip, the question and one button, and
    anything that changes what the round *is* takes a page of its own
    rather than a mode on that screen (docs/DECISIONS.md). */
export function featurePath(slug: string): string {
  return `/${slug}`;
}

/* `image` is what makes a topic a picture topic (docs/DECISIONS.md,
   2026-09-09); `text` stays the prompt in both kinds, so a picture round
   is the same round with a picture over the same sentence. Optional, and
   absent rather than empty on the wire: home ships the whole bank inline
   and an empty key on all thousand rows is 34KB the browser parses for
   the sake of the twenty that use it.

   One shape for what the round draws, because a round is a round: the
   engine, the reel and the pool do not care which table a row came from.
   What they must not do is read one key for two meanings, so a prompt
   carries `style` and a passage carries `level`, each absent on the
   other - the same split the tables took (docs/DECISIONS.md). */
export type Topic = { text: string; genre: string; style?: string; slug: string; image?: string; level?: string };
export type Style = { key: string; label: string; hint: string };
export type Bank = { genres: Genre[]; topics: Topic[]; styles: Style[] };

export const EMPTY_BANK: Bank = { genres: [], topics: [], styles: [] };

/* One warm-up genre and its passages. Fetched when the genre is picked
   rather than shipped with the bank: a passage is 100 to 120 words, and
   home ships the whole bank inline so a respin costs no round trip. That
   promise is about the reel; somebody who has just chosen to read a
   passage aloud for a minute will not notice one request. */
export type Passage = { text: string; slug: string; level: string; words: number };
export type ReadGenre = { slug: string; name: string; icon: string; blurb: string; passages: Passage[] };

/* Grouped as the page shows them: easy first, because somebody who has
   never done this needs an obvious way in. A difficulty the bank does not
   hold is simply absent rather than an empty heading. */
export const LEVELS: { key: string; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "hard", label: "Hard" },
];

export function passagesByDifficulty(genre: ReadGenre): { label: string; passages: Passage[] }[] {
  return LEVELS.map(({ key, label }) => ({
    label,
    passages: genre.passages.filter((passage) => passage.level === key),
  })).filter((group) => group.passages.length > 0);
}

export function genreBySlug(bank: Bank, slug: string): Genre | undefined {
  return bank.genres.find((genre) => genre.slug === slug);
}

export function topicsOf(bank: Bank, slug: string): Topic[] {
  return bank.topics.filter((topic) => topic.genre === slug);
}

export function topicCounts(bank: Bank): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const topic of bank.topics) counts[topic.genre] = (counts[topic.genre] ?? 0) + 1;
  return counts;
}

/* A genre's topics grouped under the styles the bank offers, in the bank's
   order, skipping Surprise me (it is a filter, not a style) and any style
   the genre happens not to hold. */
export function topicsByStyle(bank: Bank, slug: string): { style: Style; topics: Topic[] }[] {
  const topics = topicsOf(bank, slug);
  return bank.styles
    .filter((style) => style.key !== "surprise")
    .map((style) => ({ style, topics: topics.filter((topic) => topic.style === style.key) }))
    .filter((group) => group.topics.length > 0);
}
