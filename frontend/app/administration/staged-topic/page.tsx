import { operator } from "@/app/administration/page";
import { StagedTool } from "@/components/administration/staged";
import { fetchMine } from "@/lib/api";
import { fetchBank } from "@/lib/bank";
import { withOwn } from "@/lib/owned";

export const metadata = { title: "Staged topic", robots: { index: false, follow: false } };

export default async function StagedRoute() {
  await operator();
  /* The operator's own genres are in the picker too, so a demo can be
     staged on the topics somebody wrote for the video they are filming. */
  const [bank, mine] = await Promise.all([fetchBank(), fetchMine()]);
  return <StagedTool bank={withOwn(bank, mine.genres)} />;
}
