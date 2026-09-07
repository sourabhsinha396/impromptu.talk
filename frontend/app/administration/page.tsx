import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ToolIcon } from "@/components/site/icons";
import { currentUser } from "@/lib/api";

/* Never indexed and never linked: this path is typed by the one person
   who uses it. */
export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

/* The four tools, in the order the grid reads. A tuple rather than a
   table: these are pages that exist in the source, so a row saying
   otherwise could only ever be wrong. */
const TOOLS = [
  {
    href: "/administration/staged-topic",
    slug: "staged-topic",
    name: "Staged topic",
    blurb: "Rig what the next spin lands on, in this browser only.",
  },
  {
    href: "/administration/pro",
    slug: "pro",
    name: "Pro by hand",
    blurb: "Give Pro without charging for it, and take it back.",
  },
  {
    href: "/administration/payouts",
    slug: "payouts",
    name: "Affiliate payouts",
    blurb: "Who is owed what, and what has been sent.",
  },
  {
    href: "/administration/outreach",
    slug: "outreach",
    name: "Outreach",
    blurb: "The message to a creator, addressed, and who has had it.",
  },
];

export default async function AdministrationRoute() {
  await operator();
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <h1 className="font-display text-headline font-semibold">Administration</h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
        Four tools. The tables are in the admin; these act on an account or on this browser.
      </p>
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block rounded-card border border-line bg-card p-4.5 text-ink no-underline transition-colors hover:border-accent"
          >
            <ToolIcon slug={tool.slug} size={22} className="text-accent" />
            <span className="mt-2.5 block text-base font-semibold">{tool.name}</span>
            <span className="mt-1 block text-[13px] leading-[1.45] text-muted">{tool.blurb}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

/** The gate every page here shares: a 404 for anybody who is not a
    superuser, signed out or not, because a redirect to sign-in confirms
    the path was guessed right. The routes behind the pages answer 404
    too; a page that hides a button is not a permission. */
export async function operator() {
  const user = await currentUser();
  if (!user?.is_superuser) notFound();
  return user;
}
