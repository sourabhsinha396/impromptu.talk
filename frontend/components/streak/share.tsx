"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/site/button";

/* Sharing, on the streak page: one button that mints the link, or the
   link once it exists with a way to open it. Nothing else here; turning
   it off lives in the account's additional settings, because this is the
   page you come to in order to show somebody, not to think about it. */
export function Share({ url }: { url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/runs/share", { method: "POST" });
      /* The page re-reads its data and draws the link; nothing to hold
         here, and the same path shows a link made on another device. */
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[15px] font-semibold">Share your progress, publicly:</h2>
      {url ? (
        <div className="flex max-w-[640px] flex-wrap items-center gap-2.5">
          <input
            type="text"
            readOnly
            value={url}
            aria-label="Your public link"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-[220px] flex-1 rounded-full border border-line-strong bg-card2 px-3.5 py-2.5 text-sm font-medium text-ink"
          />
          <Button href={url} variant="ghost">
            Open it
          </Button>
        </div>
      ) : (
        <Button onClick={create} disabled={busy}>
          Create a link
        </Button>
      )}
      <p className="mt-2.5 max-w-[52ch] text-sm text-muted">
        One link with your streak and your last eight weeks. Your name, never your email.
      </p>
    </section>
  );
}
