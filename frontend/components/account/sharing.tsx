"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyField } from "@/components/account/copy-field";
import { Hint, Refused, SectionBody, SectionFoot } from "@/components/account/section";
import { absolute } from "@/lib/site";

/** The switch that turns the public streak page on and off.

    A switch and not two buttons: sharing is on or it is off, and the
    control should say which without being read. The link sits beside it
    while it is on, because the next thing anybody does after turning
    sharing on is send it to somebody. */
export function Sharing({ token }: { token: string | null }) {
  const router = useRouter();
  const [on, setOn] = useState(token !== null);
  const [url, setUrl] = useState(token ? absolute(`/s/${token}`) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function flip() {
    const wanted = !on;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/runs/share", { method: wanted ? "POST" : "DELETE" });
      if (!response.ok) {
        setError("That did not go through. Try again.");
        return;
      }
      /* Turning it on hands back the link to draw; turning it off leaves
         nothing to draw, because the token is gone rather than parked. */
      setUrl(wanted ? absolute(`/s/${((await response.json()) as { token: string }).token}`) : "");
      setOn(wanted);
      /* The streak page carries the same link, so it is re-read rather
         than left showing a link this page has just killed. */
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionBody>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[15px] font-semibold">{on ? "Your link works" : "Sharing is off"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Sharing"
            disabled={busy}
            onClick={flip}
            className={`relative h-7 w-12 flex-none cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed ${
              on ? "border-accent bg-accent" : "border-line-strong bg-card2"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-[3px] left-[3px] size-5 rounded-full transition-transform ${
                on ? "translate-x-5 bg-surface" : "bg-line-strong"
              }`}
            />
          </button>
        </div>
        {on && url && (
          <div className="mt-3.5">
            <CopyField url={url} label="Your share link" />
          </div>
        )}
      </SectionBody>
      <SectionFoot>
        {error ? (
          <Refused>{error}</Refused>
        ) : (
          <Hint>Turning it off kills the link at once. Sharing again makes a new one.</Hint>
        )}
      </SectionFoot>
    </>
  );
}
