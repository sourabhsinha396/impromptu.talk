"use client";

import { useState } from "react";

import { Box, BoxFoot, Field, Heading, INPUT, Tool } from "@/components/administration/shell";
import { Button } from "@/components/site/button";
import type { Pro } from "@/lib/administration";
import { cn } from "@/lib/utils";

const FAILED = "That did not go through. Try again.";

/* Giving Pro away, and taking it back. One form rather than the eight
   fields the admin would need: a reference invented on the spot and a
   session id for a checkout that never happened is how a gift silently
   does nothing at eleven at night. */
export function ProTool({ pro: initial }: { pro: Pro }) {
  const [pro, setPro] = useState(initial);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(initial.lengths[0]?.code ?? "comp");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(path: string, body: Record<string, unknown>, said: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json().catch(() => null)) as (Pro & { detail?: string }) | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        return;
      }
      if (answer) setPro(answer);
      setNotice(said);
    } catch {
      setError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tool
      name="Pro by hand"
      lede="Give an account Pro without charging for it. They need an account first; this never makes one."
    >
      <Box>
        <Field label="Email">
          <input
            type="email"
            value={email}
            autoComplete="off"
            placeholder="creator@example.com"
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT}
          />
        </Field>
        <p className="mt-3.5 mb-1.5 text-[13.5px] font-semibold">How long</p>
        <div className="flex flex-wrap gap-2">
          {pro.lengths.map((length) => (
            <button
              key={length.code}
              type="button"
              aria-pressed={plan === length.code}
              onClick={() => setPlan(length.code)}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-2 text-sm font-semibold",
                plan === length.code
                  ? "border-accent bg-card text-accent-strong"
                  : "border-line-strong bg-card2 text-ink",
              )}
            >
              {length.label}
            </button>
          ))}
        </div>
        <BoxFoot note="Nothing is charged and nothing is announced.">
          <Button
            size="sm"
            disabled={busy || email.trim() === ""}
            onClick={() => send("/api/v1/administration/pro", { email, plan }, "Done. They have Pro now.")}
          >
            Give Pro
          </Button>
        </BoxFoot>
      </Box>

      {(error || notice) && (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-xl border border-line border-l-[3px] bg-card2 px-4 py-3 text-[14.5px] font-semibold",
            error ? "border-l-ink" : "border-l-accent",
          )}
        >
          {error || notice}
        </p>
      )}

      <Heading>Live gifts</Heading>
      {pro.gifts.length === 0 ? (
        <p className="text-[15px] text-muted">Nothing given away right now.</p>
      ) : (
        <table className="w-full border-collapse text-[14.5px]">
          <thead>
            <tr>
              <Th>Account</Th>
              <Th>Length</Th>
              <Th>Until</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {pro.gifts.map((gift) => (
              <tr key={gift.id}>
                <Td>{gift.email}</Td>
                <Td>{gift.plan}</Td>
                <Td>
                  {gift.until ? (
                    day(gift.until)
                  ) : (
                    <span className="rounded-full border border-line bg-card2 px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">
                      Forever
                    </span>
                  )}
                </Td>
                <Td className="w-px text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      send(
                        "/api/v1/administration/pro/revoke",
                        { purchase_id: gift.id },
                        "Taken back. That account is on the free tier again.",
                      )
                    }
                  >
                    Take it back
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        A purchase that took money is not in this list. Pulling Pro off one is a refund, and a refund starts at the
        provider.
      </p>
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
