import type { Metadata } from "next";

import { StreakPage } from "@/components/streak/streak-page";
import { currentUser, practiceHistory } from "@/lib/api";
import { fetchBank } from "@/lib/bank";
import { pageMetadata } from "@/lib/metadata";

/* noindex: one browser's own numbers, which say nothing to a crawler. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your streak",
    description: "Your impromptu speaking streak, topics practised and minutes spoken.",
    path: "/streak",
  }),
  robots: { index: false, follow: false },
};

export default async function StreakRoute() {
  const [history, bank, user] = await Promise.all([practiceHistory(), fetchBank(), currentUser()]);
  return <StreakPage history={history} bank={bank} user={user} />;
}
