import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { YourGenres } from "@/components/genres/yours";
import { currentUser, fetchMine } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

/* Your own tongue twisters, under the feature that runs them rather than
   under `/genres/yours`. Each feature owns its whole vertical: the page
   that practises it, the page that lists yours, and the editor. Borrowing
   the genre list would have put passages and prompts in one grid under a
   heading that fits neither, and it is the same reason the round itself
   left home (docs/DECISIONS.md).

   noindex: a page about one account's own writing. `/tongue-twisters` is
   the crawlable surface. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your tongue twisters",
    description: "The passages you wrote, read on the same scroller.",
    path: "/pro/custom-tongue-twisters",
  }),
  robots: { index: false, follow: false },
};

export default async function YourWarmUpsRoute() {
  const user = await currentUser();
  /* The same landing the genre list uses when a session expires between
     the proxy's gate and this render. */
  if (!user) redirect("/login?next=/pro/custom-tongue-twisters");
  const mine = await fetchMine();
  return <YourGenres mine={mine} isPro={user.is_pro} kind="read" />;
}
