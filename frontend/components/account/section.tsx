import type { ReactNode } from "react";

import { CheckIcon } from "@/components/site/icons";

/* The pieces the two settings pages are made of, as approved in
   docs/mocks/account.html.

   Every setting is a card: a heading, one sentence, its control and its
   own Save. v0 stacked a small grey label, a form and a hint with nothing
   around them, so eight settings read as one long page of loose parts and
   nothing said where one ended and the next began. */

export function Section({
  title,
  tag,
  description,
  children,
}: {
  title: string;
  tag?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mt-[22px] rounded-card border border-line bg-card p-4 sm:px-[22px] sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16.5px] font-semibold tracking-[-0.01em]">{title}</h2>
        {tag}
      </div>
      {description && <p className="mt-1.5 max-w-[56ch] text-sm text-muted">{description}</p>}
      {children}
    </section>
  );
}

/** The control, under the heading and its sentence. */
export function SectionBody({ children }: { children: ReactNode }) {
  return <div className="mt-4">{children}</div>;
}

/** The row a card ends on: the button, then whatever it needs to say
    beside it. The hint sits next to the control rather than under the
    whole card, so the sentence explaining a button is beside the button. */
export function SectionFoot({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-3.5">{children}</div>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="min-w-[200px] flex-1 max-w-[60ch] text-[13.5px] text-muted">{children}</p>;
}

/** A word beside a heading: a plan, a state, where an account came from. */
export function Tag({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold ${
        live ? "border-accent text-accent-strong" : "border-line-strong bg-card2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/* Facts as rows rather than a paragraph: what you are on, what it charges
   and when it happens next are three separate questions, and a paragraph
   makes you read all of it to answer one. */

export function Rows({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-line bg-card2">{children}</div>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-[15px] py-3 last:border-b-0">
      <span className="text-[13.5px] font-semibold text-muted">{label}</span>
      <span className="text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** What just happened, in the card that did it. v0 reloaded the page and
    printed one banner at the top, so after saving your name you scrolled
    up to learn whether it worked. */
export function Saved() {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-strong">
      <CheckIcon size={14} />
      Saved
    </span>
  );
}

/** A refusal, in the same place the confirmation would have been. */
export function Refused({ children }: { children: ReactNode }) {
  return (
    <span role="alert" className="text-[13.5px] font-semibold">
      {children}
    </span>
  );
}
