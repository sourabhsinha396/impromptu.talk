"use client";

import { type FormEvent, useState } from "react";

import { Alert, Field, Notice, submit } from "@/components/auth/form";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";

/* The same sentence whether or not the address has an account: the
   backend answers 204 either way, so this form cannot be used to ask
   whether somebody is a member. */
const SENT = "If that address has an account, a link is on its way. Check your spam folder too.";

export function ForgotForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const sentence = await submit("/api/v1/auth/forgot", { email: form.get("email") });
    if (sentence === null) setSent(true);
    else setError(sentence);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-[18px]">
      {error && <Alert>{error}</Alert>}
      {sent && <Notice>{SENT}</Notice>}
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus />
      </Field>
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        Send the link
      </Button>
    </form>
  );
}
