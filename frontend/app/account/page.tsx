import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccentPicker } from "@/components/account/accent-picker";
import { Section, Tag } from "@/components/account/section";
import { ACCOUNT, ADDITIONAL, OtherPage, SettingsPage } from "@/components/account/shell";
import { Subscription } from "@/components/account/subscription";
import { accountSettings, refreshEntitlement } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";

/* noindex: one person's own account, which says nothing to a crawler. */
export const metadata: Metadata = {
  ...pageMetadata({ title: "Settings", description: "Your account and your subscription.", path: ACCOUNT }),
  robots: { index: false, follow: false },
};

export default async function AccountRoute({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  /* One of the two moments an entitlement can have changed is the way
     back from the provider's portal. Re-read once, then land on the
     plain URL so a reload does not ask again. */
  if ((await searchParams).back === "portal") {
    await refreshEntitlement();
    redirect(ACCOUNT);
  }
  const settings = await accountSettings();
  /* The proxy already turned strangers away at the cookie; this catches
     a session the backend has since ended, and a backend that is not
     answering, both of which would otherwise render a page about
     nobody. */
  if (settings === null) redirect("/login?next=/account");

  const { plan } = settings;
  /* Pro with no plan held means the shop is shut: nothing is for sale, so
     nothing is gated and there is nothing to name. Three states, and the
     section says which one it is in rather than going quiet. */
  const free = !plan && !settings.is_pro;

  return (
    <SettingsPage title="Your account." email={settings.email} plan={plan} current={ACCOUNT}>
      {/* Subscription first: the only section whose answer changes on its
          own. Purchases, which need rows to list, land with card 31's
          affiliate section as the last of these to fill in. */}
      {plan ? (
        <Section title="Subscription" tag={<Tag>{plan.cancels ? "Cancelled" : plan.recurring ? "Renews" : "Paid once"}</Tag>}>
          <Subscription plan={plan} />
        </Section>
      ) : free ? (
        <Section
          title="Subscription"
          tag={<Tag>Free</Tag>}
          description="You are on the free plan. A five day streak, 25 rounds of history, and every genre."
        />
      ) : (
        <Section title="Subscription" description="Everything is free right now." />
      )}

      <Section title="Colour" description="It colours the topic, your streak and links.">
        <AccentPicker accent={settings.accent} pro={settings.is_pro} />
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
