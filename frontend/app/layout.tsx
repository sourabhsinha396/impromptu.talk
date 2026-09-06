import type { Metadata } from "next";
import "./globals.css";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { currentUser } from "@/lib/api";
import { timezoneInit } from "@/lib/cookies";
import { OG_IMAGE } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { themeInit } from "@/lib/theme";
import { visitorCountry } from "@/lib/visitor";

/* `title.template` rather than a per-page string: every page sets its own
   title, and without a template each one prints alone with no way of telling
   which site it came from in a tab strip or a search result. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, country] = await Promise.all([currentUser(), visitorCountry()]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The two latin font files are wanted on every page, for the body
            and for the topic, and the browser would not discover them until
            it had parsed the stylesheet. `crossOrigin` is required even
            same-origin: fonts are fetched in CORS mode, and a preload without
            it is a second, wasted download. The latin-ext files are left to
            `unicode-range`, which fetches them only if a page needs them. */}
        <link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: timezoneInit }} />
      </head>
      <body className="bg-surface font-sans text-ink antialiased">
        <div className="flex min-h-screen flex-col">
          {/* The streak arrives with the streak cards; until then there is
              none to show, and the pill stays absent as it does for a
              stranger. */}
          <Header user={user} streak={0} />
          {children}
          <Footer signedIn={user !== null} inIndia={country === "IN"} />
        </div>
      </body>
    </html>
  );
}
