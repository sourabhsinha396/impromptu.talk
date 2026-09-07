import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refund policy",
  description:
    "Seven days, no questions asked. How to get an impromptu.talk Pro payment back, and how a subscription is cancelled.",
  path: "/refunds",
});

/* Written before there was anything to sell, which is why it reads the
   way it does: a policy that first appears on the day money changes
   hands is one nobody read before paying.

   v0's version said "a one-time payment never renews, so there is
   nothing to cancel" and then, two bullets later, "nothing renews" -
   which was false for exactly the people it mattered to. This page names
   which shapes renew before it says what cancelling does. */
export default function RefundsRoute() {
  return (
    <Doc label="Refund policy" headline="Seven days, no questions." updated="7 September 2026">
      <p>
        Almost all of {SITE_NAME} is free: the round, all thousand topics, the timers and a five day streak. The one
        thing you can buy is <A href="/pro">Pro</A>. It is sold two ways, and which one you are buying is on the card
        you buy it from, on your receipt, and in <A href="/account">your account</A> afterwards.
      </p>

      <h2>Pro</h2>
      <ul>
        <li>
          <b>Seven days, no questions.</b> Ask within seven days of the payment and it is refunded in full.
        </li>
        <li>
          <b>A subscription renews until you cancel it</b>, monthly or yearly. Cancel whenever you like from{" "}
          <A href="/account">your account</A>, which opens the payment provider&rsquo;s own portal. Cancelling stops
          the next charge and keeps the period already paid for, so Pro runs out on the date it was always going to
          rather than the day you cancelled.
        </li>
        <li>
          <b>A 30 day pass and a lifetime never renew.</b> There is nothing to cancel and nothing to forget about: a
          payment you make today cannot become a payment next year.
        </li>
        <li>
          After seven days, ask anyway. Pro is a record of practice you did yourself, not a download, and if it has not
          been worth it, say so.
        </li>
      </ul>

      <h2>When something is broken</h2>
      <p>
        If a paid feature does not do what its page said it would, that is a refund whenever you notice it, not within
        seven days. Tell us what happened and we will fix it or return the money; you should not have to argue about
        which.
      </p>

      <h2>How to ask</h2>
      <p>
        Write to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> with the email address used at checkout and
        the date of the payment. Refunds are approved or declined within three working days, and the money goes back
        the way it came - typically five to ten working days to appear, depending on your bank.
      </p>
      <p>
        Payments are handled by Dodo Payments as merchant of record, so a refund is issued through them, and their name
        rather than ours is what appears on your statement.
      </p>

      <h2>Chargebacks</h2>
      <p>
        Write to us first. A chargeback costs us a fee and takes weeks; an email is answered in days and gets you the
        same money back.
      </p>

      <h2>Changes</h2>
      <p>
        This page may be updated. The terms that apply to a purchase are the ones published on the day it was made, not
        the ones here later.
      </p>
    </Doc>
  );
}
