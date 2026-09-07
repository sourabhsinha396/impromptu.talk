"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert, Field, submit } from "@/components/auth/form";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";

/* The name is optional: the rule is an email and eight characters and
   nothing else, and a person who wants to keep a streak should not be
   stopped for a name they can add in settings later. */
export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const sentence = await submit("/api/v1/auth/signup", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (sentence === null) {
      router.push(next);
      router.refresh();
      return;
    }
    setError(sentence);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-[18px]">
      {error && <Alert>{error}</Alert>}
      <Field id="name" label="Name" aside="Optional">
        <Input id="name" name="name" type="text" autoComplete="name" maxLength={80} autoFocus />
      </Field>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Field id="password" label="Password" aside="8 or more characters">
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        Create account
      </Button>
    </form>
  );
}
