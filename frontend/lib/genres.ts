/* The ten genres, by slug, in the order the picker shows them. The names
   and blurbs come from the bank; the slugs are fixed, and the sitemap and
   the icon map key on them without a round trip. */
export const GENRE_SLUGS = [
  "general",
  "everyday-life",
  "relationships",
  "career",
  "money-business",
  "tech-ai",
  "science",
  "health",
  "philosophy",
  "culture",
] as const;

export type GenreSlug = (typeof GENRE_SLUGS)[number];

/* The slug an owned genre wears inside the bank. Prefixed, because the
   built-in slugs above are a flat namespace the picker, the reel and
   `/genre/<slug>` all key on, and "career" the built-in and "career" of
   somebody's own must never be the same row. v0 used `pack:`; the shape
   is the same and the word is not, since these are genres.

   These live here rather than beside the fetchers in `lib/owned.ts`
   because the picker is a client component, and that module reaches the
   backend through `next/headers`. */
export const OWN_PREFIX = "yours:";

export function ownSlug(slug: string): string {
  return `${OWN_PREFIX}${slug}`;
}

export function isOwnSlug(slug: string): boolean {
  return slug.startsWith(OWN_PREFIX);
}

/** The editor path for a genre wearing its picker slug. Defensive about
    the prefix: a slug that never had one is its own path, rather than
    losing its first six characters. */
export function ownPath(slug: string): string {
  return `/genres/yours/${isOwnSlug(slug) ? slug.slice(OWN_PREFIX.length) : slug}`;
}
