import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SharedPage } from "@/components/streak/shared-page";
import { sharedPractice } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/site";

type Params = { params: Promise<{ token: string }> };

/* noindex: a page about one person. The topic pages are the crawlable
   surface; a thousand thin pages about people would dilute them, and this
   link is for sending, not ranking. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const shared = await sharedPractice(token);
  if (!shared) return { robots: { index: false, follow: false } };
  const who = shared.name || "A speaker";
  return {
    ...pageMetadata({
      title: `${who} on ${SITE_NAME}`,
      description: `${shared.streak} day streak, ${shared.topics} topics, ${shared.minutes} minutes spoken.`,
      path: `/s/${token}`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function SharedRoute({ params }: Params) {
  const { token } = await params;
  const shared = await sharedPractice(token);
  if (!shared) notFound();
  return <SharedPage shared={shared} />;
}
