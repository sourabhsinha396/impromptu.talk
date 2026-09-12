import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Editor } from "@/components/genres/editor";
import { currentUser, fetchMine, fetchOwned } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Edit your tongue twisters",
    description: "Your own passages.",
    path: "/pro/custom-tongue-twisters",
  }),
  robots: { index: false, follow: false },
};

/* The editor for one set of your passages. The same component the genre
   editor uses, because the differences are what it already branches on:
   the paste splits on paragraphs, there is no style tail, and there are no
   pictures. What differs here is only which path it belongs to.

   No styles are passed. A passage has none - nobody chooses how to say
   words they are reading verbatim - so the select the genre editor draws
   has nothing to offer, and fetching the bank to fill it would be a round
   trip for a control that is hidden. */
export default async function WarmUpEditorRoute({ params }: Params) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/pro/custom-tongue-twisters/${slug}`);
  const [genre, mine] = await Promise.all([fetchOwned(slug), fetchMine()]);
  /* A slug somebody else holds is not this account's business, so it is
     the same 404 as a slug nobody holds. */
  if (!genre) notFound();
  /* A genre of prompts opened here belongs to the other editor: sent
     there rather than 404ed, because the row exists and the person owns
     it - they have simply arrived by the wrong door. */
  if (genre.mode !== "read") redirect(`/genres/yours/${slug}`);
  return (
    <Editor
      genre={genre}
      styles={[]}
      isPro={user.is_pro}
      canGenerate={false}
      generationsLeft={mine.generations_left}
      maxTopics={mine.max_passages ?? 0}
    />
  );
}
