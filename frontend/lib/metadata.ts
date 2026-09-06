import type { Metadata } from "next";

import { absolute } from "@/lib/site";

/* One card for the whole site. Rendered once from docs/assets/og-card.html
   with headless Chrome; nothing there ships to a browser. */
export const OG_IMAGE = "/og.png";

/* What a link to a page looks like when somebody pastes it somewhere. A
   page writes its title and description once here and the canonical, the
   Open Graph card and the Twitter card all follow, so no page can say one
   thing in the tab and another on the card. The root layout supplies the
   site name, the template and the image. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: absolute(path), images: [OG_IMAGE] },
    twitter: { title, description, images: [OG_IMAGE] },
  };
}
