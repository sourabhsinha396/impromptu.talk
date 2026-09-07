"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert, Field, FieldLink, submit } from "@/components/auth/form";
import { useRecaptcha } from "@/components/auth/recaptcha";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";

/* `noValidate`: the server's sentence is the one voice on this form, so
   a blank field is told the same way a wrong one is, and the typing stays
   whatever was refused. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const recaptcha = useRecaptcha();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const sentence = await submit("/api/v1/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
      recaptcha_token: recaptcha.token,
    });
    if (sentence === null) {
      /* Refresh as well as push: the header and the footer were rendered
         for a stranger, and the session cookie has just changed that. */
      router.push(next);
      router.refresh();
      return;
    }
    recaptcha.reset();
    setError(sentence);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-[18px]">
      {error && <Alert>{error}</Alert>}
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus />
      </Field>
      <Field id="password" label="Password" aside={<FieldLink href="/forgot">Forgotten?</FieldLink>}>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </Field>
      {recaptcha.widget}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
