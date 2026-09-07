"use client";

import { useState } from "react";

import { Hint, Refused, Saved, SectionBody, SectionFoot } from "@/components/account/section";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/forms";

/** Change the password, or set the first one on a Google-only account.

    An account with a password confirms the old one: this browser is
    already signed in, so without that a borrowed laptop is a taken
    account. One that came in through Google has no current password and
    is never asked for one it could not supply. */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const refusal = await sendJson("POST", "/api/v1/auth/password", { current, password });
    setBusy(false);
    setError(refusal ?? "");
    if (refusal) return;
    /* Nothing typed here is worth keeping on screen once it has landed,
       and the fields are the only copy of it in the page. */
    setCurrent("");
    setPassword("");
    setDone(true);
  }

  function typing(set: (value: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      set(event.target.value);
      setDone(false);
      setError("");
    };
  }

  return (
    <>
      <SectionBody>
        {hasPassword && (
          <div className="mb-3.5 max-w-[420px]">
            <Label htmlFor="current-password" className="mb-[7px] block">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={typing(setCurrent)}
            />
          </div>
        )}
        <div className="max-w-[420px]">
          <div className="mb-[7px] flex items-baseline justify-between gap-3">
            <Label htmlFor="new-password">New password</Label>
            <span className="text-[13px] font-medium text-muted">8 or more characters</span>
          </div>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={typing(setPassword)}
          />
        </div>
      </SectionBody>
      <SectionFoot>
        <Button size="sm" onClick={save} disabled={busy || password.length === 0}>
          {hasPassword ? "Change password" : "Set a password"}
        </Button>
        {error ? <Refused>{error}</Refused> : done ? <Saved /> : null}
        <Hint>This signs out every other browser. You stay signed in here.</Hint>
      </SectionFoot>
    </>
  );
}
