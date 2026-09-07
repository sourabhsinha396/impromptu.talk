import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/site/button";
import { CheckIcon } from "@/components/site/icons";
import { settlePurchase, type Receipt } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({ title: "Your receipt", description: "Your Pro purchase.", path: "/pro/done" }),
  robots: { index: false, follow: false },
};

type Query = { ref?: string; payment_id?: string; subscription_id?: string; status?: string };

export default async function DoneRoute({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  if (!query.ref) notFound();

  /* Settling on the way in: the provider's return URL is a GET, and this
     read is the only thing that moves a row to paid. Idempotent, so a
     reload today or next year grants nothing twice. */
  const receipt = await settlePurchase(query.ref, query.payment_id ?? "", query.subscription_id ?? "");
  if (receipt === null) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-[clamp(16px,4vw,32px)] pt-11 pb-[72px]">
      {receipt.status === "paid" ? <Paid receipt={receipt} /> : <NotYet receipt={receipt} />}
    </main>
  );
}

function Paid({ receipt }: { receipt: Receipt }) {
  return (
    <>
      <Mark done />
      <Headline>You have Pro.</Headline>
      <Lede>Your history, your own genres and the longer streak are on, right now.</Lede>
      <Rows>
        <Row label="Plan" note={receipt.recurring ? "Renews every period" : "Paid once"}>
          {receipt.plan_name}
        </Row>
        <Row label="Paid">{receipt.charged}</Row>
        {receipt.expires_at && (
          <Row label={receipt.recurring ? "Renews" : "Until"}>{when(receipt.expires_at)}</Row>
        )}
        <Row label="Reference">
          <span className="font-mono text-[13px]">{receipt.reference}</span>
        </Row>
      </Rows>
      <Actions>
        <Button href="/" size="lg">
          Start a round
        </Button>
        <Button href="/account" variant="ghost" size="lg">
          Your account
        </Button>
      </Actions>
      <Hint>
        {receipt.recurring ? (
          <>
            Cancelling is in <Faded href="/account">your account</Faded>, and it keeps the period you have paid for.
          </>
        ) : (
          <>A copy of this is in your inbox. Keep the reference if you ever write to us.</>
        )}
      </Hint>
    </>
  );
}

/** Pending and failed are two different sentences and one shape. Pending
    is not an error: with no webhooks, a buyer who closes the tab before
    the redirect lands here, and the link in their receipt settles it
    whenever they come back. */
function NotYet({ receipt }: { receipt: Receipt }) {
  const failed = receipt.status === "failed";
  return (
    <>
      <Mark done={false} />
      <Headline>{failed ? "That payment did not go through." : "Still with the bank."}</Headline>
      <Lede>
        {failed
          ? "Nothing was charged. Your card was not accepted, or the checkout was closed."
          : "Your payment has not come back to us yet. This page settles it the moment it does."}
      </Lede>
      <Rows>
        <Row label="Plan">{receipt.plan_name}</Row>
        <Row label="Reference">
          <span className="font-mono text-[13px]">{receipt.reference}</span>
        </Row>
      </Rows>
      <Actions>
        <Button href="/pro" size="lg">
          {failed ? "Try again" : "Check again"}
        </Button>
        <Button href="/" variant="ghost" size="lg">
          Start a round
        </Button>
      </Actions>
      <Hint>
        {failed ? (
          <>
            If money did leave your account, write to <Faded href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Faded>{" "}
            with that reference and we will sort it out.
          </>
        ) : (
          <>Nothing is lost. The link in your receipt opens this page, today or next week, and settles it then.</>
        )}
      </Hint>
    </>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Mark({ done }: { done: boolean }) {
  return (
    <div
      className={`grid size-14 place-items-center rounded-full ${
        done ? "bg-accent text-surface" : "border border-line-strong bg-card2 text-muted"
      }`}
    >
      {done ? <CheckIcon size={28} strokeWidth={2.6} /> : <ClockGlyph />}
    </div>
  );
}

function ClockGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-[22px] font-display text-[clamp(2rem,6vw,2.8rem)] leading-[1.05] font-semibold">{children}</h1>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 max-w-[46ch] text-base text-muted">{children}</p>;
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="mt-7 overflow-hidden rounded-card border border-line bg-card">{children}</div>;
}

function Row({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
      <span className="text-[13.5px] font-semibold text-muted">{label}</span>
      <span className="text-right font-semibold [overflow-wrap:anywhere]">
        {children}
        {note && <small className="mt-0.5 block text-[12.5px] font-medium text-muted">{note}</small>}
      </span>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-[26px] flex flex-wrap gap-3">{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[52ch] text-[13.5px] text-muted">{children}</p>;
}

function Faded({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent-strong">
      {children}
    </Link>
  );
}
