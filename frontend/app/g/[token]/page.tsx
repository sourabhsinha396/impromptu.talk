import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SharedGenrePage } from "@/components/genres/shared-genre";
import { fetchSharedGenre } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

type Params = { params: Promise<{ token: string }> };

/* noindex, like the shared streak: this is somebody's own list, sent to
   the people they sent it to. The bank's genre pages are the crawlable
   surface, and a thousand thin pages would only dilute them. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const shared = await fetchSharedGenre(token);
  if (!shared) return { robots: { index: false, follow: false } };
  return {
    ...pageMetadata({
      title: shared.name,
      description: `${shared.topics.length} speaking topics, shared with you.`,
      path: `/g/${token}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function SharedGenreRoute({ params }: Params) {
  const { token } = await params;
  /* Null covers a token nobody holds and one whose owner turned sharing
     off, and both are the same 404: an off switch has to mean the link
     you already sent is dead. */
  const shared = await fetchSharedGenre(token);
  if (!shared) notFound();
  return <SharedGenrePage shared={shared} />;
}
