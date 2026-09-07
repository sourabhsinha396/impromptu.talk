"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert, Field, submit } from "@/components/auth/form";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";

/* The new password and nothing else; the token came in the path. A
   success is a session, so the tool is where it lands. */
export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const sentence = await submit("/api/v1/auth/reset", { token, password: form.get("password") });
    if (sentence === null) {
      router.push("/");
      router.refresh();
      return;
    }
    setError(sentence);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-[18px]">
      {error && <Alert>{error}</Alert>}
      <Field id="password" label="New password" aside="8 or more characters">
        <Input id="password" name="password" type="password" autoComplete="new-password" autoFocus />
      </Field>
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        Save and sign in
      </Button>
    </form>
  );
}
