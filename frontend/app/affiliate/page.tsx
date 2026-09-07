import type { Metadata } from "next";
import Link from "next/link";

import { CopyField } from "@/components/account/copy-field";
import { Button } from "@/components/site/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { programme } from "@/lib/affiliates";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Affiliates",
  description: "Share your link and keep 30% of what anybody buys through it. Every account has one.",
  path: "/affiliate",
});

/* The public pitch, as mocked in docs/mocks/affiliate.html. Every number
   on it is the backend's, read from the constants settlement pays under,
   because a page promising a rate the code does not honour is the first
   thing a creator would catch us in. */
export default async function AffiliateRoute() {
  const { percent, cookie_days: days, minimum_payout: minimum, link } = await programme();

  const questions: { q: string; a: React.ReactNode }[] = [
    {
      q: "How much is it, exactly?",
      a: `${percent}% of what the person was actually charged, in dollars. Prices differ by country, so a lifetime bought in India earns ${percent}% of the rupee price, not of $39.`,
    },
    {
      q: "Do renewals earn?",
      a: "No. A subscription earns on its first charge only. We learn about payments when somebody comes back to the site, and a renewal happens where we never hear it.",
    },
    {
      q: "How long does a click last?",
      a: `${days} days. The last link clicked is the one that counts, and if they already had an account, whoever brought them in keeps them.`,
    },
    {
      q: "When do I get paid?",
      a: (
        <>
          By PayPal, once your balance is over {minimum}. Add your address on{" "}
          <Faded href="/affiliate/referrals">your referrals page</Faded> and we send it by hand.
        </>
      ),
    },
    {
      q: "What if somebody refunds?",
      a: "The commission comes off your balance. You will see the refund on your list as its own line.",
    },
    {
      q: "Can I refer myself?",
      a: "No. Your own purchases never earn, and neither does a second account of your own.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-[34px] pb-[72px]">
      <h1 className="font-display text-[clamp(2rem,5.5vw,3.2rem)] leading-[1.05] font-semibold text-balance">
        Share the link, keep {percent}%.
      </h1>
      <p className="mt-3 max-w-[58ch] text-[17px] text-muted">
        Every account has a link. Somebody buys through it, you keep {percent}% of what they paid. No application, no
        minimum audience.
      </p>

      {/* Signed in, the link is the thing they came for and it is already
          minted; signed out, it cannot exist yet, so the button is the
          honest way to ask for an account. */}
      {link ? (
        <div className="mt-6 max-w-[560px]">
          <CopyField url={link} label="Your affiliate link" />
          <p className="mt-2.5 text-[13.5px] text-muted">
            <Faded href="/affiliate/referrals">Your referrals</Faded> shows what it has earned.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <Button href="/signup?next=/affiliate" size="xl">
            Get your link
          </Button>
        </div>
      )}

      <div className="mt-9 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Step n="One">
          Send your link. It is your name after the site&rsquo;s, and it works from anywhere: a post, a video
          description, a message.
        </Step>
        <Step n="Two">
          They practise free, then buy. The click is remembered for {days} days, so it still counts weeks later.
        </Step>
        <Step n="Three">
          You keep {percent}% of what they were charged. Paid by PayPal once you are over {minimum}.
        </Step>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-[23px] font-semibold tracking-[-0.02em]">Who this is for</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Face initials="RS" name="Coach" what="Speaking, interviews">
            Sends the link with a warm-up drill. Their students practise between sessions.
          </Face>
          <Face initials="AT" name="Teacher" what="A class of 30">
            Puts the link in the class notes. A minute of speaking is the homework.
          </Face>
          <Face initials="MK" name="Creator" what="Short videos">
            Films one round, drops the link below it. The tool is the video.
          </Face>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 font-display text-[23px] font-semibold tracking-[-0.02em]">Questions</h2>
        <Accordion type="single" collapsible defaultValue="q0">
          {questions.map(({ q, a }, index) => (
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

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-card p-4.5">
      <b className="mb-2 block text-xs font-semibold tracking-[0.08em] text-accent-strong uppercase">{n}</b>
      <p className="m-0 text-[15px] leading-[1.5]">{children}</p>
    </div>
  );
}

/* Labelled a sample under each face rather than in a footnote at the
   bottom of the page: three testimonials with the disclaimer somewhere
   below them is the wrong way round. */
function Face({
  initials,
  name,
  what,
  children,
}: {
  initials: string;
  name: string;
  what: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-4.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-[38px] place-items-center rounded-full bg-card2 text-sm font-semibold text-accent-strong">
          {initials}
        </span>
        <span>
          <span className="block text-[14.5px] font-semibold">{name}</span>
          <span className="block text-xs text-muted">{what}</span>
        </span>
      </div>
      <p className="mt-3 text-sm leading-[1.5] text-muted">{children}</p>
      <p className="mt-3.5 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">
        Sample, not a real person
      </p>
    </div>
  );
}

function Faded({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent-strong">
      {children}
    </Link>
  );
}
