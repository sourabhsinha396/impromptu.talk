import type { Metadata } from "next";

import { AccountPage, Alert, DoorLink, OtherDoor } from "@/components/auth/form";
import { ResetForm } from "@/components/auth/reset-form";
import { resetLinkLive } from "@/lib/api";

/* `no-referrer`: the page loads fonts and analytics, and without this the
   token in the address would ride out in a Referer header. noindex: a
   page about one link. */
export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function ResetPage({ params }: Props) {
  const { token } = await params;
  const live = await resetLinkLive(token);

  return (
    <AccountPage title="Choose a new password" lede="The link works once, for an hour.">
      {live ? (
        <ResetForm token={token} />
      ) : (
        <>
          <div className="mt-6">
            <Alert>That link has expired or has already been used.</Alert>
          </div>
          <OtherDoor>
            <DoorLink href="/forgot">Send a new link</DoorLink>.
          </OtherDoor>
        </>
      )}
    </AccountPage>
  );
}
