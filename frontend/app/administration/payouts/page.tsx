import { notFound } from "next/navigation";

import { operator } from "@/app/administration/page";
import { PayoutsTool } from "@/components/administration/payouts";
import { payoutsTool } from "@/lib/administration";

export const metadata = { title: "Affiliate payouts", robots: { index: false, follow: false } };

export default async function PayoutsRoute() {
  await operator();
  const payouts = await payoutsTool();
  if (!payouts) notFound();
  return <PayoutsTool payouts={payouts} />;
}
