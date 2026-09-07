import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refund Policy",
  description: "Refunds within seven days of payment, no questions asked, and how a subscription is cancelled.",
  path: "/refunds",
});

/* Only what somebody arrives here to find out. What Pro is, what is
   free, and which shapes renew are the pricing page's job, and repeating
   them here is a page that has to be read past (owner's call). What must
   stay is the window, the cancel path and how to ask, and none of it may
   contradict the pricing page: v0 said "nothing renews" two bullets from
   a line saying a subscription renews until cancelled. */
export default function RefundsRoute() {
  return (
    <Doc name="Refund Policy" updated="7 September 2026">
      <h2>Refunds</h2>
      <ul>
        <li>Ask within seven days of a payment and it is refunded in full, no questions asked.</li>
        <li>
          After seven days, write to us anyway. Requests are considered individually, and a paid feature that does not
          do what its page described is refunded whenever you notice it.
        </li>
      </ul>

      <h2>Cancelling a subscription</h2>
      <p>
        Cancel at any time from <A href="/account">your account</A>, which opens the payment provider&rsquo;s portal.
        Cancelling stops the next charge and keeps the period already paid for, so access ends on the date it was
        already due to end, not the day you cancelled.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Write to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> with the email address used at checkout and
        the date of the payment. Requests are approved or declined within three working days.
      </p>

      <h2>Chargebacks</h2>
      <p>
        Please contact us before raising a chargeback. A chargeback takes several weeks and incurs a fee; an email is
        answered within three working days and returns the same amount.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        This page may be updated. The terms that apply to a purchase are the ones published on the date it was made.
      </p>
    </Doc>
  );
}
