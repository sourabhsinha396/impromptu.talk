"use client";

import { useState } from "react";

import { Button } from "@/components/site/button";
import { CheckIcon, CopyIcon } from "@/components/site/icons";

/** A link somebody is meant to hand to another person: the whole URL,
    readable, with one button that takes it. v0 printed the link as text
    to select by hand. Selecting on focus stays, because the clipboard is
    not available on every browser and over plain http it is not available
    at all. */
export function CopyField({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* No clipboard: the field is already selected on focus, so the
         person can still take the link. Nothing to say about it. */
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        readOnly
        value={url}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-[10px] border border-line-strong bg-card2 px-3.5 py-3 text-[15px] font-medium text-ink"
      />
      <Button variant="ghost" size="sm" onClick={copy}>
        {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
