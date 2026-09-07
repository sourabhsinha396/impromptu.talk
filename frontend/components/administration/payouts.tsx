"use client";

import { useState } from "react";

import { Box, BoxFoot, Field, Heading, INPUT, Tool } from "@/components/administration/shell";
import { Button } from "@/components/site/button";
import type { Owed, Payouts } from "@/lib/administration";
import { cn } from "@/lib/utils";

const FAILED = "That did not go through. Try again.";

/* What the admin cannot show: who is owed what, derived from purchases
   and payouts every time it is asked. Nothing here sends money - the
   money moves at PayPal and this is where it is written down after, the
   same order a refund follows and for the same reason. */
export function PayoutsTool({ payouts: initial }: { payouts: Payouts }) {
  const [payouts, setPayouts] = useState(initial);
  const [picked, setPicked] = useState<Owed | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(row: Owed) {
    setPicked(row);
    /* The balance fills the field as a starting point and stays editable:
       PayPal takes a fee off some transfers, so it is a suggestion and
       never an instruction. */
    setAmount(row.balance.replace("$", ""));
    setError("");
    setNotice("");
  }

  async function record() {
    if (!picked) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/administration/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: picked.user_id, amount, reference }),
      });
      const answer = (await response.json().catch(() => null)) as (Payouts & { detail?: string }) | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        return;
      }
      if (answer) setPayouts(answer);
      setNotice("Written down. Their balance is lower by that much.");
      setPicked(null);
      setAmount("");
      setReference("");
    } catch {
      setError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tool name="Affiliate payouts" lede="Who is owed what. Send it in PayPal first, then write it down here.">
      {payouts.owed.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">Nobody has earned anything yet.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-[14.5px]">
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th>PayPal</Th>
              <Th className="text-right">Balance</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {payouts.owed.map((row) => (
              <tr key={row.user_id}>
                <Td>{row.email}</Td>
                <Td>
                  {row.paypal_email || (
                    /* Called out rather than left blank: somebody sitting
                       on a balance with nowhere to send it is a support
                       mail waiting to happen. */
                    <span className="rounded-full border border-warn px-2.5 py-0.5 text-[11.5px] font-semibold text-warn">
                      No address
                    </span>
                  )}
                </Td>
                <Td className="text-right font-semibold tabular-nums">{row.balance}</Td>
                <Td className="w-px text-right whitespace-nowrap">
                  <Button variant={row.ready ? "primary" : "ghost"} size="sm" onClick={() => choose(row)}>
                    Record
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {picked && (
        <Box>
          <h2 className="text-base font-semibold">Write down a transfer</h2>
          <p className="mt-1 mb-3 text-[13.5px] text-muted">
            To {picked.email}, who is owed {picked.balance}. Minimum worth sending is {payouts.minimum}.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <input
                type="text"
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Reference">
              <input
                type="text"
                value={reference}
                placeholder="PayPal transaction id"
                onChange={(event) => setReference(event.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
          <BoxFoot note="More than the balance is refused.">
            <span className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy || amount.trim() === ""} onClick={record}>
                Write it down
              </Button>
            </span>
          </BoxFoot>
        </Box>
      )}

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

      {payouts.recent.length > 0 && (
        <>
          <Heading>Recently paid</Heading>
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Affiliate</Th>
                <Th>Reference</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {payouts.recent.map((paid, index) => (
                <tr key={`${paid.at}-${index}`}>
                  <Td>{day(paid.at)}</Td>
                  <Td>{paid.email}</Td>
                  <Td>{paid.reference || "-"}</Td>
                  <Td className="text-right font-semibold tabular-nums">{paid.amount}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Tool>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "pr-2 pb-2 text-left text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase",
        className,
      )}
    >
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
