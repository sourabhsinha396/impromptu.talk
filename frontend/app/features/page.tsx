import type { Metadata } from "next";

import { FeaturesPage } from "@/components/features/features-page";
import { currentUser } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

const TITLE = "Features";
const DESCRIPTION = "Everything in yapholic.com: what's free forever, what Pro adds, and what's still coming.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/features" });

export default async function FeaturesRoute() {
  const user = await currentUser();
  return <FeaturesPage isPro={user?.is_pro ?? false} />;
}
