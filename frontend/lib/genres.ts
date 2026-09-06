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
