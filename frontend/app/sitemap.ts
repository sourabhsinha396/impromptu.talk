import type { MetadataRoute } from "next";

import { GENRE_SLUGS } from "@/lib/genres";
import { absolute } from "@/lib/site";

/* Home, /genres, the paperwork and every genre. Not the topics, and not
   the share pages. The thousand topics are still crawlable, every one a
   link on its genre page, so dropping them costs a crawler nothing but a
   shortcut. What it buys is a file that says which pages route into the
   tool, rather than one in which the ten that do are 1% of the lines.

   `priority` is here knowing Google ignores it outright. Bing and the
   smaller crawlers still read it, it costs a number, and the shape it
   describes is true: the tool first, then the genre pages that route
   into it. */
export const PAGES: [string, number][] = [
  ["/", 1.0],
  ["/genres", 0.9],
  ...GENRE_SLUGS.map((slug): [string, number] => [`/genre/${slug}`, 0.8]),
  ["/pro", 0.5],
  ["/affiliate", 0.4],
  ["/about", 0.3],
  ["/contact", 0.3],
  ["/privacy", 0.3],
  ["/terms", 0.3],
  ["/refunds", 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, priority]) => ({ url: absolute(path), priority }));
}
