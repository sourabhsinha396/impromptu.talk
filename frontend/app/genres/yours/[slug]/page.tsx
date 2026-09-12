import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Editor } from "@/components/genres/editor";
import { currentUser, fetchBank, fetchMine, fetchOwned } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

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
  /* A warm-up opened here belongs to the feature that runs it. Sent there
     rather than 404ed: the row exists and this account owns it, they have
     just come by the wrong door. */
  if (genre.mode === "read") redirect(`/pro/custom-tongue-twisters/${slug}`);
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
