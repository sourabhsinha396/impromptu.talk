import type { Metadata } from "next";
import Link from "next/link";

import { Plans } from "@/components/pro/plans";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { catalogue, currentUser } from "@/lib/api";
import { pageMetadata } from "@/lib/metadata";
import { visitorCurrency } from "@/lib/visitor";

export const metadata: Metadata = pageMetadata({
  title: "Pro",
  description: "Subscribe monthly or yearly, or pay once for thirty days or for life. The round, every topic and your streak stay free.",
  path: "/pro",
});

/* The questions somebody actually asks, in that order. The first one is
   what stays free, because that is the strongest thing on the page for a
   product whose free tier is the funnel, and v0 had written it and then
   commented it out. */
const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What stays free?",
    a: "The round, every genre in the bank, unlimited practice and a five day streak. No account needed. None of it is ever taken away to sell Pro.",
  },
  { q: "Do one-time payments renew?", a: "No. Nothing to cancel, nothing to forget about." },
  {
    q: "How do I cancel?",
    a: (
      <>
        In <Faded href="/account">your account</Faded>. Cancelling keeps the period you have paid for, so Pro runs out
        on the date it was always going to.
      </>
    ),
  },
  {
    q: "What if it is not for me?",
    a: (
      <>
        Seven days, no questions. See the <Faded href="/refunds">refund policy</Faded>.
      </>
    ),
  },
  { q: "Can I change currency?", a: "Yes, above the cards. You are charged in the one shown on the button you press." },
];

export default async function ProRoute({ searchParams }: { searchParams: Promise<{ currency?: string }> }) {
  /* The picked currency reaches this render through the query string, and
     the proxy has already written it to the cookie for the next one. */
  const picked = (await searchParams).currency ?? "";
  const currency = picked || (await visitorCurrency());
  const [priced, user] = await Promise.all([catalogue(currency), currentUser()]);

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-[34px] pb-[72px]">
      <h1 className="font-display text-[clamp(2.2rem,7vw,3.4rem)] leading-[1.05] font-semibold">Pro.</h1>
      <p className="mt-2.5 text-[17px] text-muted">Practising is free. Pro keeps what you make.</p>

      {/* Said before the prices, because somebody who already holds it is
          here to check what they have, not to buy it again. Both halves
          matter: with nothing for sale every account reads as Pro, and
          announcing it over a page that says "not open yet" would be a
          lie about a thing nobody bought. */}
      {priced.selling && user?.is_pro && (
        <p
          role="status"
          className="mt-[22px] rounded-xl border border-line border-l-[3px] border-l-accent bg-card2 px-4 py-3 text-[14.5px] font-semibold"
        >
          You have Pro.{" "}
          <Link href="/streak" className="font-semibold text-accent-strong">
            Your history
          </Link>
          .
        </p>
      )}

      <Plans catalogue={priced} signedIn={user !== null} />

      <section className="mt-11">
        <h2 className="mb-1 font-display text-[23px] font-semibold tracking-[-0.02em]">Questions</h2>
        <Accordion type="single" collapsible defaultValue="q0">
          {QUESTIONS.map(({ q, a }, index) => (
            <AccordionItem key={q} value={`q${index}`}>
              <AccordionTrigger className="text-[15.5px]">{q}</AccordionTrigger>
              <AccordionContent className="max-w-[66ch] text-[15px] leading-[1.5] text-muted">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}

function Faded({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent-strong">
      {children}
    </Link>
  );
}
