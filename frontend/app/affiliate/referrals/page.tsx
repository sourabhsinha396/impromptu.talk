import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReferralsPage } from "@/components/affiliates/referrals";
import { referrals } from "@/lib/affiliates";
import { pageMetadata } from "@/lib/metadata";

/* noindex: one person's own earnings. `/affiliate` is the page that is
   meant to rank. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Your referrals",
    description: "What your affiliate link has earned.",
    path: "/affiliate/referrals",
  }),
  robots: { index: false, follow: false },
};

export default async function ReferralsRoute() {
  const page = await referrals();
  /* The proxy already gates this path on the cookie; this is what happens
     when a session expires between the two, and it is the same landing. */
  if (!page) redirect("/login?next=/affiliate/referrals");
  return <ReferralsPage page={page} />;
}
