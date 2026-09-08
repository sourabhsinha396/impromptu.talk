import type { Metadata } from "next";

import { ForgotForm } from "@/components/auth/forgot-form";
import { AccountPage, DoorLink, OtherDoor } from "@/components/auth/form";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Forgotten your password?",
  description: "Send yourself a link to choose a new yapholic.com password.",
  path: "/forgot",
});

export default function ForgotPage() {
  return (
    <AccountPage title="Forgotten your password?" lede="Type your email. We will send a link.">
      <ForgotForm />
      <OtherDoor>
        Remembered it? <DoorLink href="/login">Sign in</DoorLink>.
      </OtherDoor>
    </AccountPage>
  );
}
