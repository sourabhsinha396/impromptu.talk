"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Hint, SectionFoot } from "@/components/account/section";
import { Button } from "@/components/site/button";

/** Ends every session this account has, this one included.

    It asks first, which v0 did not: one click on a button labelled with
    what it does to other people also signs you out of the page you are
    standing on, and that is a surprise worth one question. */
export function SignOutEverywhere() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const response = await fetch("/api/v1/auth/logout/everywhere", { method: "POST" });
    if (!response.ok) {
      setBusy(false);
      setAsking(false);
      return;
    }
    /* Home rather than the sign-in page: this is a settings page nobody
       is trying to get back into, and the tool is where somebody goes
       next. The proxy would send them to sign in anyway if they came
       back here. */
    router.push("/");
    router.refresh();
  }

  if (!asking) {
    return (
      <SectionFoot>
        <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
          Sign out everywhere
        </Button>
        <Hint>This one included, so you will sign in again here.</Hint>
      </SectionFoot>
    );
  }

  return (
    <SectionFoot>
      <span className="text-sm font-semibold">Sign out of every browser?</span>
      <Button size="sm" onClick={signOut} disabled={busy}>
        Yes, sign out
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAsking(false)} disabled={busy}>
        Cancel
      </Button>
    </SectionFoot>
  );
}
