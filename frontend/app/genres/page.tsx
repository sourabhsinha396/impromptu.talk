import type { Metadata } from "next";

import { Hub } from "@/components/genres/hub";
import { fetchBank } from "@/lib/bank";
import { pageMetadata } from "@/lib/metadata";
import { collectionPage, jsonLd } from "@/lib/structured-data";

const TITLE = "All genres";
const DESCRIPTION = "Ten genres of impromptu speaking topics, every one with every style. Pick a subject and spin.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/genres" });

export default async function GenresPage() {
  const bank = await fetchBank();
  const data = collectionPage(
    TITLE,
    DESCRIPTION,
    "/genres",
    bank.genres.map((genre) => `/genre/${genre.slug}`),
  );
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <Hub bank={bank} />
    </>
  );
}
