import type { Metadata } from "next";
import "./globals.css";

import { cookies } from "next/headers";

import { Analytics } from "@/components/site/analytics";
import { Chat } from "@/components/site/chat";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { analyticsConfig } from "@/lib/analytics";
import { currentUser } from "@/lib/api";
import { DEVICE_COOKIE, deviceIdFrom, timezoneInit } from "@/lib/cookies";
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
  const [user, country, jar] = await Promise.all([currentUser(), visitorCountry(), cookies()]);
  const analytics = analyticsConfig();
  const crispWebsiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "";

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
        {/* The address reaches the browser only when there is an account
            and analytics are on at all: an anonymous visitor stays
            anonymous, which is the promise /privacy makes to the people
            who never sign up. */}
        {analytics && (
          <Analytics
            token={analytics.token}
            host={analytics.host}
            deviceId={deviceIdFrom(jar.get(DEVICE_COOKIE)?.value)}
            email={user?.email ?? ""}
            name={user?.name ?? ""}
          />
        )}
        {crispWebsiteId && <Chat websiteId={crispWebsiteId} email={user?.email} name={user?.name} />}
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
