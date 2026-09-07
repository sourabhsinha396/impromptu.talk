import { notFound } from "next/navigation";

import { operator } from "@/app/administration/page";
import { ProTool } from "@/components/administration/pro";
import { proTool } from "@/lib/administration";

export const metadata = { title: "Pro by hand", robots: { index: false, follow: false } };

export default async function ProRoute() {
  await operator();
  const pro = await proTool();
  /* Null means the backend said no, which for these routes is the same
     404 the page itself gives anybody who may not be here. */
  if (!pro) notFound();
  return <ProTool pro={pro} />;
}
