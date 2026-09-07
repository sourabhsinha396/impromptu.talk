import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountPage, DoorLink, OtherDoor } from "@/components/auth/form";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { currentUser } from "@/lib/api";
import { authHref, safeNext } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Create an account",
  description: "Keep your impromptu.talk streak when the browser forgets. Free, and your practice comes with you.",
  path: "/signup",
});

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignupPage({ searchParams }: Props) {
  const [{ next }, user] = await Promise.all([searchParams, currentUser()]);
  const to = safeNext(next);
  if (user) redirect(to);

  return (
    <AccountPage title="Create an account" lede="Keep your streak on any device.">
      <GoogleButton next={to} />
      <SignupForm next={to} />
      <OtherDoor>
        Already have one? <DoorLink href={authHref("/login", to)}>Sign in</DoorLink>.
      </OtherDoor>
    </AccountPage>
  );
}
