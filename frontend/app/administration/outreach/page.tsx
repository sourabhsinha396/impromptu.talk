import { notFound } from "next/navigation";

import { operator } from "@/app/administration/page";
import { OutreachTool } from "@/components/administration/outreach";
import { outreachTool } from "@/lib/administration";

export const metadata = { title: "Outreach", robots: { index: false, follow: false } };

export default async function OutreachRoute() {
  await operator();
  const outreach = await outreachTool();
  if (!outreach) notFound();
  return <OutreachTool outreach={outreach} />;
}
