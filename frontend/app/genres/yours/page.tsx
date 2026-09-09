import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { YourGenres } from "@/components/genres/yours";
import { currentUser, fetchMine } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

/* noindex: a page about one account's own topics. The bank's genre pages
   are the crawlable surface. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your genres",
    description: "The speaking topics you wrote, in the same picker as the bank.",
    path: "/genres/yours",
  }),
  robots: { index: false, follow: false },
};

export default async function YourGenresRoute() {
  const user = await currentUser();
  /* The proxy already gates this path on the cookie; this is what happens
     when a session expires between the two, and it is the same landing. */
  if (!user) redirect("/login?next=/genres/yours");
  const mine = await fetchMine();
  return <YourGenres mine={mine} isPro={user.is_pro} />;
}
