import Link from "next/link";
import type { ReactNode } from "react";

/* The frame both settings pages share: where you are, who you are, and
   the bar between the two pages.

   v0 ended /account with a section called "Additional settings" whose
   only content was a button to a page called "Additional settings". The
   bar names both pages and shows which one you are on, which is what a
   person needs to know before they go looking for a setting. */

export const ACCOUNT = "/account";
export const ADDITIONAL = "/account/additional-settings";

export function SettingsPage({
  title,
  email,
  current,
  children,
}: {
  title: string;
  email: string;
  current: typeof ACCOUNT | typeof ADDITIONAL;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-[clamp(16px,4vw,32px)] pt-[30px] pb-[72px]">
      <p className="mb-1.5 text-[13px] font-semibold text-muted">
        {current === ACCOUNT ? "Settings" : <Link href={ACCOUNT}>Settings</Link>}
      </p>
      <h1 className="font-display text-[clamp(2.2rem,7vw,3.4rem)] leading-[1.05] font-semibold">{title}</h1>
      {/* The account this is, said once. v0's /account never showed the
          address at all: it was on the other page, so the page about your
          account could not tell you which one you were signed in as. */}
      <p className="mt-3.5 flex flex-wrap items-center gap-2.5 text-[15px] text-muted">
        <span className="font-semibold text-ink [overflow-wrap:anywhere]">{email}</span>
      </p>
      <nav className="mt-[26px] flex gap-[26px] border-b border-line">
        <Tab href={ACCOUNT} on={current === ACCOUNT}>
          Account
        </Tab>
        <Tab href={ADDITIONAL} on={current === ADDITIONAL}>
          Additional settings
        </Tab>
      </nav>
      {children}
    </main>
  );
}

function Tab({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`-mb-px border-b-2 pb-3 text-[14.5px] font-semibold ${
        on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/** The line at the foot of each page pointing at the other one, for
    somebody who scrolled past the bar looking for a setting. */
export function OtherPage({ children }: { children: ReactNode }) {
  return <p className="mt-[26px] px-0.5 text-sm text-muted">{children}</p>;
}
