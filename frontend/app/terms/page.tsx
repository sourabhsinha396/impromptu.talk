import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { programme } from "@/lib/affiliates";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "The terms that apply to using impromptu.talk, its topics, paid features and affiliate programme.",
  path: "/terms",
});

/* The affiliate rate is read from the backend rather than typed here.
   It is the one number in this prose that money depends on, and a term
   promising a rate settlement does not pay would only ever be found by
   the person it shortchanged. */
export default async function TermsRoute() {
  const { percent, minimum_payout: minimum } = await programme();

  return (
    <Doc name="Terms and Conditions" updated="7 September 2026">
      <p>These terms apply to everyone who uses {SITE_NAME}. Using the service means accepting them.</p>

      <h2>1. The service</h2>
      <p>
        A speaking-practice tool: a random topic, a prep phase, a timed speaking phase, and a streak counted from
        completed rounds. Most of it is free. An account is optional and carries your streak between devices.
      </p>

      <h2>2. Acceptable use</h2>
      <ul>
        <li>Use the service for your own practice, or with your class, club or team.</li>
        <li>Do not scrape the topic bank, resell it, or republish it as your own topic generator.</li>
        <li>Do not attempt to disrupt, overload or gain unauthorised access to the service.</li>
        <li>Do not use the service unlawfully in your jurisdiction.</li>
      </ul>

      <h2>3. The topics</h2>
      <p>
        The topics remain our property. You may speak about them, print them, and use them with students or a club at
        no cost and without permission. Republishing the bank, or a substantial part of it, is not permitted. The
        name, wordmark and design remain ours.
      </p>
      <p>
        Topics are written to be spoken about, not to be factually authoritative. A prompt is not a statement of our
        opinion and is not advice of any kind.
      </p>

      <h2>4. Content you provide</h2>
      <p>
        Prep notes are never transmitted to us; see the <A href="/privacy">privacy policy</A>. Topics you write in your
        own genres remain yours. We store them so that the service can present them to you, and we show them to anyone
        you share that genre&rsquo;s link with.
      </p>

      <h2>5. Streaks without an account</h2>
      <p>
        Without an account, a streak is tied to an anonymous identifier in a cookie. Clearing cookies, changing browser
        or using another device will not carry it over. This is a consequence of not requiring registration and is not
        a fault we can correct.
      </p>

      <h2>6. Availability</h2>
      <p>
        The service is provided on an as-is and as-available basis. We do not warrant that it will be uninterrupted or
        error free, or that stored data will be retained indefinitely. Features may change or be withdrawn.
      </p>

      <h2>7. Liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for any loss arising from use of the service,
        including loss of a streak or of stored practice history. Nothing in these terms limits liability that cannot
        lawfully be limited.
      </p>

      <h2>8. Paid features</h2>
      <p>
        <A href="/pro">Pro</A> is sold either as a subscription billed monthly or yearly, which renews until cancelled,
        or as a one-time payment that does not renew. The price, the billing shape and what is included are stated at
        the point of purchase. Subscriptions are cancelled from <A href="/account">your account</A>, and cancelling
        retains the period already paid for. Payments are processed by Dodo Payments as merchant of record; we neither
        see nor store card details. The <A href="/refunds">refund policy</A> applies.
      </p>

      <h2>9. Affiliate programme</h2>
      <p>
        Every account has an <A href="/affiliate">affiliate link</A>. When somebody who followed it purchases Pro, the
        referring account is credited with {percent}% of the amount that purchase paid us, converted to US dollars, and
        the credit is reversed if the purchase is refunded. Earnings are paid by PayPal once a balance reaches{" "}
        {minimum}, to the address given on the referrals page. Purchases on your own account do not earn commission.
        Links promoted by spam, by paid clicks, or with untrue claims about the service may result in withheld earnings
        and account closure. The rate may change for future purchases and never for purchases already made.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        These terms may be updated. The date above states when they last changed, and continued use after that date
        constitutes acceptance of the updated version.
      </p>

      <h2>11. Contact</h2>
      <p>
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>
      </p>
    </Doc>
  );
}
