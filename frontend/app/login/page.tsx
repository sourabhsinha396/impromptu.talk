import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountPage, DoorLink, OtherDoor } from "@/components/auth/form";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/lib/api";
import { authHref, safeNext } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to impromptu.talk to pick your streak up on any device.",
  path: "/login",
});

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const [{ next }, user] = await Promise.all([searchParams, currentUser()]);
  const to = safeNext(next);
  /* Already in: there is nothing here to do, so go where they were going. */
  if (user) redirect(to);

  return (
    <AccountPage title="Sign in" lede="Pick your streak up where you left it.">
      <LoginForm next={to} />
      <OtherDoor>
        No account yet? <DoorLink href={authHref("/signup", to)}>Create an account</DoorLink>.
      </OtherDoor>
    </AccountPage>
  );
}
