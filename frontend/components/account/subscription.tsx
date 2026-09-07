"use client";

import { useState } from "react";

import { Hint, Refused, Row, Rows, SectionBody, SectionFoot } from "@/components/account/section";
import { Button } from "@/components/site/button";
import type { Plan } from "@/lib/api";

/** The held plan, and the one door out to the provider's portal.
    Cancelling, a new card and past invoices all live behind that link. */
export function Subscription({ plan }: { plan: Plan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function portal() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/payments/portal", { method: "POST" });
      const answer = await response.json().catch(() => null);
      if (!response.ok || !answer?.url) {
        setError(typeof answer?.detail === "string" ? answer.detail : "Could not open the portal. Try again.");
        setBusy(false);
        return;
      }
      window.location.href = answer.url;
    } catch {
      setError("Could not open the portal. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <SectionBody>
        <Rows>
          <Row label="Plan">{plan.name}</Row>
          {plan.expires_at && <Row label={endLabel(plan)}>{when(plan.expires_at)}</Row>}
        </Rows>
      </SectionBody>
      <SectionFoot>
        <Button variant="ghost" size="sm" onClick={portal} disabled={busy}>
          {plan.recurring ? "Manage subscription" : "Invoices and receipts"}
        </Button>
        {error ? <Refused>{error}</Refused> : <Hint>{sentence(plan)}</Hint>}
      </SectionFoot>
    </>
  );
}

function endLabel(plan: Plan): string {
  if (!plan.recurring) return "Until";
  return plan.cancels ? "Ends" : "Renews";
}

function sentence(plan: Plan): string {
  if (plan.recurring && plan.cancels) {
    return "Cancelled. Nothing more will be charged, and Pro is yours until that date.";
  }
  if (plan.recurring) {
    return "Cancel it, change the card, or take an invoice. Cancelling keeps the time you have paid for.";
  }
  if (plan.expires_at) return "Nothing renews, so there is nothing to cancel.";
  return "Paid once, and that is the end of it. No renewal, no expiry.";
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
