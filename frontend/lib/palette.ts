/* The six accents somebody can pick, and nothing else about colour.

   A fixed set rather than a picker, and the reason is in globals.css beside
   the numbers: the accent colours the topic, which is the largest text on
   the site and the thing people film from across a room. An arbitrary
   colour there is an unreadable topic; six checked ones cannot be.

   What is chosen is a hue, never a lightness. The theme owns lightness, so
   a colour cannot change how legible the topic is, only which legible
   colour it is. lib/palette.test.ts holds the contrast ratios to that
   promise, read straight out of the stylesheet. */

/* Slug to display name, in the order the swatches render. Lime is first
   because it is the default, and the default is what no stored choice
   means: no row is written for somebody who never chose. */
export const ACCENTS = {
  lime: "Lime",
  amber: "Amber",
  coral: "Coral",
  magenta: "Magenta",
  violet: "Violet",
  cyan: "Cyan",
} as const;

export type Accent = keyof typeof ACCENTS;

export const DEFAULT_ACCENT: Accent = "lime";

/** The slug if we offer it, otherwise the default.

    Anything unrecognised is the default rather than an error: this value is
    rendered into an attribute on <html>, and the one thing it must never be
    is whatever somebody typed. */
export function validAccent(slug: string | null | undefined): Accent {
  return slug !== null && slug !== undefined && slug in ACCENTS ? (slug as Accent) : DEFAULT_ACCENT;
}
