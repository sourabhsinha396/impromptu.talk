import Link from "next/link";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/* The pieces the account forms share, as approved in docs/mocks/signin.html:
   one narrow column, a field with its label row, one sentence above the
   form when something is refused, and one line out. */

export function AccountPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[440px] flex-1 px-[clamp(16px,4vw,32px)] pt-11 pb-16">
      <h1 className="font-display text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.05] font-semibold">{title}</h1>
      <p className="mt-2.5 text-[15.5px] text-muted">{lede}</p>
      {children}
    </main>
  );
}

/* The label row carries the way out: "Forgotten?" beside Password on sign
   in, "8 or more characters" beside it on sign up. That is where somebody
   is looking when they need it, not the foot of a form they have given up
   on. A div and an explicit `for` rather than a wrapping label, because
   an anchor inside a label is a link that also focuses the field. */
export function Field({ id, label, aside, children }: { id: string; label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-[7px] flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside && <span className="text-[13px] font-medium text-muted">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

export function FieldLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-muted underline decoration-line-strong underline-offset-3 hover:text-ink hover:decoration-ink"
    >
      {children}
    </Link>
  );
}

/* A refusal is one sentence with an ink edge. Not the warm colour: that
   is the clock's, in its last ten seconds, and it means one thing. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[10px] border border-line border-l-[3px] border-l-ink bg-card2 px-3.5 py-[11px] text-[14.5px] leading-[1.45] font-semibold"
    >
      {children}
    </p>
  );
}

/* A notice is the same box with the accent edge: something went right. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-[10px] border border-line border-l-[3px] border-l-accent bg-card2 px-3.5 py-[11px] text-[14.5px] leading-[1.45] font-semibold"
    >
      {children}
    </p>
  );
}

export function OtherDoor({ children }: { children: ReactNode }) {
  return <p className="mt-[22px] text-sm text-muted">{children}</p>;
}

export function DoorLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-ink">
      {children}
    </Link>
  );
}

const FAILED = "Something went wrong. Try again.";

/** Post a form as JSON. Null when it went through; otherwise the one
    sentence to print above the form. The backend answers every refusal a
    person can act on with a sentence in `detail`; anything else (a 422 at
    the edge, a dead network) gets the generic one. */
export async function submit(path: string, body: Record<string, FormDataEntryValue | null>): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const answer = await response.json().catch(() => null);
    return typeof answer?.detail === "string" ? answer.detail : FAILED;
  } catch {
    return FAILED;
  }
}
