import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GenrePage } from "@/components/genres/genre-page";
import { fetchBank, genreBySlug, topicsOf } from "@/lib/bank";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd } from "@/lib/structured-data";

type Props = { params: Promise<{ slug: string }> };

/* The title reads as the long-tail query: "Career & work speaking topics". */
function copy(name: string, blurb: string) {
  return { title: `${name} speaking topics`, description: `${blurb} A random topic, a minute to think, a minute to talk.` };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const genre = genreBySlug(await fetchBank(), slug);
  if (!genre) return {};
  const { title, description } = copy(genre.name, genre.blurb);
  return pageMetadata({ title, description, path: `/genre/${slug}` });
}

/* A slug that is not a built-in genre is a 404 like any dead URL: a merged
   genre, a link that lost a letter. Never a redirect, and never a page
   for an owned genre, which has its own noindex address. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const bank = await fetchBank();
  const genre = genreBySlug(bank, slug);
  if (!genre) notFound();
  const { title, description } = copy(genre.name, genre.blurb);
  const data = itemList(
    title,
    description,
    `/genre/${slug}`,
    topicsOf(bank, slug).map((topic) => topic.text),
  );
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <GenrePage bank={bank} genre={genre} />
    </>
  );
}
