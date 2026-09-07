"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Refused, Saved, SectionBody, SectionFoot } from "@/components/account/section";
import { Button } from "@/components/site/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/forms";

/** What we call somebody. Optional at signup, so it has to be clearable
    here: a blank box saves a blank name rather than being ignored. */
export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  /* What the server holds, as far as this card knows, so Save wakes up
     when the field changes and sleeps again when it changes back. A
     button that is always live and usually does nothing teaches people
     to ignore the one time it matters. */
  const [stored, setStored] = useState(name);
  const [value, setValue] = useState(name);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = value !== stored;

  async function save() {
    setBusy(true);
    const refusal = await sendJson("PATCH", "/api/v1/auth/name", { name: value });
    setBusy(false);
    setError(refusal ?? "");
    if (refusal) return;
    setStored(value);
    setJustSaved(true);
    /* The menu and the streak page print this name, so the whole page is
       re-read rather than this card patching what it does not own. */
    router.refresh();
  }

  return (
    <>
      <SectionBody>
        <div className="max-w-[420px]">
          <div className="mb-[7px] flex items-baseline justify-between gap-3">
            <Label htmlFor="account-name">What we call you</Label>
            <span className="text-[13px] font-medium text-muted">Optional</span>
          </div>
          <Input
            id="account-name"
            value={value}
            maxLength={80}
            autoComplete="name"
            onChange={(event) => {
              setValue(event.target.value);
              setJustSaved(false);
              setError("");
            }}
          />
        </div>
      </SectionBody>
      <SectionFoot>
        <Button size="sm" onClick={save} disabled={!changed || busy}>
          Save
        </Button>
        {error ? <Refused>{error}</Refused> : justSaved && <Saved />}
      </SectionFoot>
    </>
  );
}
