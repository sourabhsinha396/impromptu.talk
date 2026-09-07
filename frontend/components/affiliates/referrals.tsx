"use client";

import Link from "next/link";
import { useState } from "react";

import { CopyField } from "@/components/account/copy-field";
import { Button } from "@/components/site/button";
import type { Referrals } from "@/lib/affiliates";
import { cn } from "@/lib/utils";

/* One affiliate's own page, as mocked in docs/mocks/affiliate.html: the
   link, three tiles, what the link has done, and where the money goes.

   Nobody on the activity list is named. The people on it did not sign up
   to be reported on, so an account is "New account" and a purchase is the
   plan it bought, which is what the affiliate is paid on and all they
   need to see. */
export function ReferralsPage({ page: initial }: { page: Referrals }) {
  const [page, setPage] = useState(initial);
  const { summary } = page;

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <h1 className="font-display text-headline font-semibold">Your referrals</h1>
      <p className="mt-3 max-w-[58ch] text-[17px] text-muted">
        Send this link. You keep {page.percent}% of what anybody buys through it.
      </p>

      <div className="mt-5 max-w-[560px]">
        <CopyField url={page.link} label="Your affiliate link" />
      </div>

      {/* Three tiles that never wrap two and one. Earned and paid sit
          under them as one sentence rather than as two more tiles: they
          are how the balance was reached, not separate facts. */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Tile n={String(summary.referrals)} label="People" />
        <Tile n={String(summary.purchases)} label="Bought" />
        <Tile n={summary.balance} label="Balance" />
      </div>
      <p className="mt-3.5 text-[15px] text-muted">
        {summary.earned === "$0.00"
          ? `Nothing yet. Send the link to one person who talks for a living.`
          : `Earned ${summary.earned} in all, ${summary.paid} already paid out.`}
      </p>

      {page.activity.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-1 font-display text-[23px] font-semibold tracking-[-0.02em]">Activity</h2>
          <ul className="m-0 list-none p-0">
            {page.activity.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex items-center gap-3 border-b border-line px-0.5 py-3">
                <span className="w-[96px] flex-none text-[13px] text-muted">{when(event.at)}</span>
                <span className="min-w-0 flex-1 text-[15px]">{event.label}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    event.kind === "refund" ? "text-warn" : "text-ink",
                  )}
                >
                  {event.amount && event.kind !== "refund" ? `+${event.amount}` : event.amount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Paypal page={page} onSaved={setPage} />

      {page.payouts.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-1 font-display text-[23px] font-semibold tracking-[-0.02em]">Paid out</h2>
          <ul className="m-0 list-none p-0">
            {page.payouts.map((payout, index) => (
              <li key={`${payout.at}-${index}`} className="flex items-center gap-3 border-b border-line px-0.5 py-3">
                <span className="w-[96px] flex-none text-[13px] text-muted">{when(payout.at)}</span>
                <span className="min-w-0 flex-1 text-[15px]">
                  PayPal{payout.reference ? ` · ${payout.reference}` : ""}
                </span>
                <span className="font-semibold tabular-nums">{payout.amount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-9 text-[13.5px] text-muted">
        How it works is on{" "}
        <Link href="/affiliate" className="font-semibold text-accent-strong">
          the affiliate page
        </Link>
        .
      </p>
    </main>
  );
}

function Tile({ n, label }: { n: string; label: string }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-card px-3.5 pt-4 pb-3.5">
      <div className="font-display text-[clamp(1.6rem,4.5vw,2.4rem)] leading-none font-semibold tracking-[-0.03em]">
        {n}
      </div>
      <div className="mt-1.5 text-[12.5px] font-semibold text-muted">{label}</div>
    </div>
  );
}

function Paypal({ page, onSaved }: { page: Referrals; onSaved: (page: Referrals) => void }) {
  const [email, setEmail] = useState(page.paypal_email);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = email.trim() !== page.paypal_email;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/affiliates/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        setError(await refusal(response));
        return;
      }
      onSaved((await response.json()) as Referrals);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      setError("That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-card border border-line bg-card p-4.5">
      <h2 className="text-base font-semibold">Where we send it</h2>
      <p className="mt-1 mb-3 text-[13.5px] text-muted">
        PayPal, once your balance is over {page.minimum_payout}. We send it by hand, so allow a few days.
      </p>
      <input
        type="email"
        value={email}
        placeholder="you@example.com"
        autoComplete="email"
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-[10px] border border-line-strong bg-card2 px-3.5 py-2.5 text-[15px] text-ink"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          {error ? <span className="text-ink">{error}</span> : saved ? "Saved" : "Only used for payouts."}
        </span>
        <Button size="sm" disabled={busy || !changed} onClick={save}>
          Save
        </Button>
      </div>
    </section>
  );
}

async function refusal(response: Response): Promise<string> {
  const answer = (await response.json().catch(() => null)) as { detail?: string } | null;
  return typeof answer?.detail === "string" ? answer.detail : "That did not go through. Try again.";
}

/* The day and the month, which is as much as any of these lines needs:
   the list is read for what happened, not for the minute it happened. */
function when(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
