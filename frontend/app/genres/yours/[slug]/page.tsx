import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Editor } from "@/components/genres/editor";
import { currentUser } from "@/lib/api";
import { fetchBank } from "@/lib/bank";
import { pageMetadata } from "@/lib/metadata";
import { fetchMine, fetchOwned } from "@/lib/owned";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  ...pageMetadata({ title: "Edit a genre", description: "Your own speaking topics.", path: "/genres/yours" }),
  robots: { index: false, follow: false },
};

export default async function EditorRoute({ params }: Params) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/genres/yours/${slug}`);
  /* The styles come from the bank, so the select offers the same four
     names the round does rather than a second copy of the vocabulary.
     `fetchMine` is what carries the cap the header prints. */
  const [genre, bank, mine] = await Promise.all([fetchOwned(slug), fetchBank(), fetchMine()]);
  /* A slug somebody else holds is not this account's business, so it is
     the same 404 as a slug nobody holds. */
  if (!genre) notFound();
  return (
    <Editor
      genre={genre}
      styles={bank.styles}
      isPro={user.is_pro}
      canGenerate={mine.can_generate}
      generationsLeft={mine.generations_left}
      maxTopics={mine.max_topics}
    />
  );
}
