import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/* The streak page is one browser's own numbers, the referrals page is one
   affiliate's own earnings, and the two operator paths answer strangers
   with a 404. None of them is protection; this keeps a crawler from
   spending its budget on pages that say nothing to it. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/streak", "/administration", "/pro/done", "/affiliate/referrals"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
