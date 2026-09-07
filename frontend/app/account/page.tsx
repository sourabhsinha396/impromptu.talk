import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccentPicker } from "@/components/account/accent-picker";
import { Section } from "@/components/account/section";
import { ACCOUNT, ADDITIONAL, OtherPage, SettingsPage } from "@/components/account/shell";
import { accountSettings } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

/* noindex: one person's own account, which says nothing to a crawler. */
export const metadata: Metadata = {
  ...pageMetadata({ title: "Settings", description: "Your account and your subscription.", path: ACCOUNT }),
  robots: { index: false, follow: false },
};

export default async function AccountRoute() {
  const settings = await accountSettings();
  /* The proxy already turned strangers away at the cookie; this catches
     a session the backend has since ended, and a backend that is not
     answering, both of which would otherwise render a page about
     nobody. */
  if (settings === null) redirect("/login?next=/account");

  return (
    <SettingsPage title="Your account." email={settings.email} current={ACCOUNT}>
      {/* Subscription first: it is the only section whose answer changes
          on its own. Payments are not built yet, so it says the one true
          thing. The plan, the charge and the date, the portal button and
          the purchases below it land with cards 24 to 26. */}
      <Section title="Subscription" description="Everything is free right now." />

      <Section
        title="Colour"
        description="It colours the topic, your streak and links."
      >
        {/* Card 24 closes Save to accounts whose Pro is live. While
            everything is free, every colour is everybody's. */}
        <AccentPicker accent={settings.accent} />
      </Section>

      <OtherPage>
        Your name, password and devices are on{" "}
        <Link href={ADDITIONAL} className="font-semibold text-ink">
          Additional settings
        </Link>
        .
      </OtherPage>
    </SettingsPage>
  );
}
