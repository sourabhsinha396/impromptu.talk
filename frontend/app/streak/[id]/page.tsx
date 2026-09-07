import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PastRound } from "@/components/streak/past-round";
import { currentUser, storedReport } from "@/lib/api";
import { fetchBank } from "@/lib/bank";
import { pageMetadata } from "@/lib/metadata";

/* noindex, like the streak page it hangs off: one person's own minute,
   which says nothing to a crawler and is nobody else's to read. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your round",
    description: "One round of impromptu speaking practice, read back.",
    path: "/streak",
  }),
  robots: { index: false, follow: false },
};

export default async function RoundRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = Number(id);
  if (!Number.isInteger(run) || run <= 0) notFound();

  const [report, bank, user] = await Promise.all([storedReport(run), fetchBank(), currentUser()]);
  /* A round somebody else made and one that never had a report answer the
     same way, so an id cannot be probed by the shape of the refusal. */
  if (!report) notFound();

  return <PastRound report={report} bank={bank} signedIn={Boolean(user)} pro={Boolean(user?.is_pro)} />;
}
