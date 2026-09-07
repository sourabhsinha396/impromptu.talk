"use client";

import { useState } from "react";

import { Box, BoxFoot, Field, Heading, INPUT, Tool } from "@/components/administration/shell";
import { Button } from "@/components/site/button";
import { CheckIcon, CopyIcon } from "@/components/site/icons";
import type { Outreach } from "@/lib/administration";
import { cn } from "@/lib/utils";

const FAILED = "That did not go through. Try again.";

/* The pitch, addressed, and the memory of who has had it. The two ways
   this goes wrong by hand are a name pasted over the wrong message and
   the same person written to twice, so the page does the addressing and
   the table is the memory. Nothing here sends anything. */
export function OutreachTool({ outreach: initial }: { outreach: Outreach }) {
  const [outreach, setOutreach] = useState(initial);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function write() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/administration/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      const answer = (await response.json().catch(() => null)) as (Outreach & { detail?: string }) | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        return;
      }
      if (answer) setOutreach(answer);
      setName("");
      setUrl("");
    } catch {
      setError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  /* Bringing a message back for somebody already written to costs no
     second row: the row is the memory, and it is already there. */
  async function again(who: string) {
    setError("");
    try {
      const response = await fetch(`/api/v1/administration/outreach?name=${encodeURIComponent(who)}`);
      if (!response.ok) {
        setError(FAILED);
        return;
      }
      setOutreach((await response.json()) as Outreach);
    } catch {
      setError(FAILED);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(outreach.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* No clipboard: the message is on the page and can be selected. */
    }
  }

  return (
    <Tool
      name="Outreach"
      lede="The message, addressed. Copy it into the app you are writing from; nothing is sent from here."
    >
      <Box>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              type="text"
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Where you found them">
            <input
              type="text"
              value={url}
              placeholder="https://instagram.com/..."
              onChange={(event) => setUrl(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        <BoxFoot note="Writing this down is how you avoid asking twice.">
          <Button size="sm" disabled={busy || name.trim() === ""} onClick={write}>
            Write the message
          </Button>
        </BoxFoot>
      </Box>

      {error && (
        <p role="status" className="mt-4 border-l-2 border-ink pl-3 text-sm font-semibold text-ink">
          {error}
        </p>
      )}

      {outreach.message && (
        <>
          <pre className="mt-4 rounded-xl border border-line bg-card2 px-4 py-3.5 text-sm leading-[1.6] whitespace-pre-wrap">
            {outreach.message}
          </pre>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </>
      )}

      {outreach.rows.length > 0 && (
        <>
          <Heading>Already written to</Heading>
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Name</Th>
                <Th>Where</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {outreach.rows.map((row) => (
                <tr key={row.id}>
                  <Td>{day(row.at)}</Td>
                  <Td>{row.name}</Td>
                  <Td className="max-w-0 truncate">{row.url || "-"}</Td>
                  <Td className="w-px text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => again(row.name)}>
                      Message
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Tool>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pr-2 pb-2 text-left text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("border-t border-line py-2.5 pr-2 align-middle", className)}>{children}</td>;
}

function day(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
