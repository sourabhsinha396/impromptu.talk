import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NameForm } from "@/components/account/name-form";
import { PasswordForm } from "@/components/account/password-form";
import { Hint, Row, Rows, Section, SectionBody, SectionFoot, Tag } from "@/components/account/section";
import { ACCOUNT, ADDITIONAL, OtherPage, SettingsPage } from "@/components/account/shell";
import { Sharing } from "@/components/account/sharing";
import { SignOutEverywhere } from "@/components/account/sign-out-everywhere";
import { Button } from "@/components/site/button";
import { accountSettings } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/site";

/* noindex, and the URL says what the page is. v0 called it /account/additional,
   which reads as half a name. */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Additional settings",
    description: "Your name, email address, password and signed-in browsers.",
    path: ADDITIONAL,
  }),
  robots: { index: false, follow: false },
};

export default async function AdditionalSettingsRoute() {
  const settings = await accountSettings();
  if (settings === null) redirect(`/login?next=${ADDITIONAL}`);
  const google = !settings.has_password;

  return (
    <SettingsPage title="Additional settings." email={settings.email} current={ADDITIONAL}>
      <Section title="Name" description="Shown in the menu and on your shared streak page. Never your email.">
        <NameForm name={settings.name} />
      </Section>

      {/* Changing an address means proving the new one, which is a trip
          this site cannot make yet. Saying so beats a field that would
          take a typo and lock somebody out of their own account. */}
      <Section title="Email" tag={google ? <Tag>Google</Tag> : undefined}>
        <SectionBody>
          <Rows>
            <Row label="Address">{settings.email}</Row>
          </Rows>
        </SectionBody>
        <SectionFoot>
          <Button href={`mailto:${CONTACT_EMAIL}`} variant="ghost" size="sm">
            Write to us
          </Button>
          <Hint>
            {google
              ? "You signed in with Google. Changing the address means a new sign-in, so write to us and it is moved for you."
              : "Changing your address needs a trip through the new one, which is not built yet. Write to us and it is moved for you."}
          </Hint>
        </SectionFoot>
      </Section>

      <Section
        title="Password"
        description={
          google
            ? "This account has no password yet. Setting one adds a second way in, and Google keeps working."
            : undefined
        }
      >
        <PasswordForm hasPassword={settings.has_password} />
      </Section>

      <Section
        title="Sharing your streak"
        description="Anyone with the link sees your streak, your last eight weeks and the topics you practised. Never your email."
      >
        <Sharing token={settings.share_token} />
      </Section>

      <Section title="Signed-in devices" description="One button ends every session we have for you.">
        <SignOutEverywhere />
      </Section>

      {/* By mail on purpose, and the page says why. Closing an account has
          to decide what happens to a purchase, and that row is what a
          refund gets argued from. */}
      <Section title="Closing your account" description="Write to us and it is done by hand, usually the same day.">
        <SectionFoot>
          <Button href={`mailto:${CONTACT_EMAIL}`} variant="ghost" size="sm">
            Write to us
          </Button>
          <Hint>
            Not a button, on purpose. Closing an account has to decide what happens to a purchase, and that row is what
            a refund gets argued from.
          </Hint>
        </SectionFoot>
      </Section>

      <OtherPage>
        Your subscription and colour are on{" "}
        <Link href={ACCOUNT} className="font-semibold text-ink">
          Account
        </Link>
        .
      </OtherPage>
    </SettingsPage>
  );
}
