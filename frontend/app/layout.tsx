import type { Metadata } from "next";
import "./globals.css";

import { timezoneInit } from "@/lib/cookies";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

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
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

/* Sets the stored theme before first paint, so a dark-mode visitor never
   gets a white flash. Inline and synchronous on purpose. Same key as v0, so
   a returning visitor keeps their choice across the rebuild. */
const themeInit = `try{var t=localStorage.getItem("impromptu.theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: timezoneInit }} />
      </head>
      <body className="bg-surface font-sans text-ink antialiased">
        <div className="flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
