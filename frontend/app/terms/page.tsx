import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { programme } from "@/lib/affiliates";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms and conditions",
  description: "The short version: use it for your own practice, do not republish the topic bank, and nothing here is a promise of uptime.",
  path: "/terms",
});

/* The affiliate rate is read from the backend rather than typed here.
   It is the one number in this prose that money depends on, and a term
   promising a rate settlement does not pay is the kind of thing that is
   only ever found by the person it shortchanged. */
export default async function TermsRoute() {
  const { percent, minimum_payout: minimum } = await programme();

  return (
    <Doc label="Terms and conditions" headline="The short version." updated="7 September 2026">
      <p>
        Using {SITE_NAME} means accepting what is below. It is deliberately short, because the service is a timer and a
        list of topics.
      </p>

      <h2>1. What we provide</h2>
      <p>
        A speaking-practice tool: a random topic, a prep phase, a timed speaking phase, and a streak counted from the
        rounds you finish. Most of it is free. An account is optional and carries your streak between devices.
      </p>

      <h2>2. Using it fairly</h2>
      <ul>
        <li>Use it for your own practice, your classroom, your club or your team. That is what it is for.</li>
        <li>Do not scrape the topic bank wholesale, resell it, or republish it as your own topic generator.</li>
        <li>Do not attack the service: no attempts to break it, overload it, or reach anything not served to you.</li>
        <li>Do not use it to break the law where you are.</li>
      </ul>

      <h2>3. The topics</h2>
      <p>
        The topics are ours. You may speak about them, print them, and use them with your students or your club for
        free, with no permission needed. Republishing the bank itself, or a substantial part of it, is what we ask you
        not to do. The name, the wordmark and the design stay ours.
      </p>
      <p>
        Topics are written to be talkable, not to be correct. A prompt is not a statement of our opinion and is not
        advice of any kind.
      </p>

      <h2>4. What you write</h2>
      <p>
        The notes you type during prep never reach us - see the <A href="/privacy">privacy policy</A>. Topics you write
        in your own genres stay yours; we store them so the tool can serve them back to you, and we show them to
        anybody you share that genre&rsquo;s link with. Do not put anything in them you would not want read aloud by a
        stranger.
      </p>

      <h2>5. No account, no guarantee of history</h2>
      <p>
        Without an account your streak is tied to an anonymous id in a cookie. Clear your cookies, switch browsers or
        use another device and it does not follow you. That is a consequence of not asking you to sign up, and it is
        not a fault we can fix for you.
      </p>

      <h2>6. Availability</h2>
      <p>
        The service is provided as is and as available. We do not promise it will be uninterrupted or error free, or
        that a stored streak will survive forever. Features may change or be withdrawn.
      </p>

      <h2>7. Liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for any loss arising from your use of the service,
        including a lost streak, a missed practice session, or an interview that did not go the way you hoped. Nothing
        here limits liability that cannot legally be limited.
      </p>

      <h2>8. Paid features</h2>
      <p>
        The round, every topic in the bank and a five day streak are free. <A href="/pro">Pro</A> keeps your whole
        history, lets you write your own genres, and colours the page. It is sold either as a subscription billed
        monthly or yearly, which renews until you cancel it, or as a one-time payment that never renews; the price,
        which of the two it is, and what it includes are stated at the point of purchase. A subscription is cancelled
        from <A href="/account">your account</A>, and cancelling keeps the period already paid for. Payments are
        handled by Dodo Payments as merchant of record rather than by us, so we never see or store your card details,
        and the <A href="/refunds">refund policy</A> applies.
      </p>

      <h2>9. Affiliates</h2>
      <p>
        Every account has an <A href="/affiliate">affiliate link</A>. When somebody who followed it buys Pro, the
        account that shared it is credited with {percent}% of what that purchase paid us, converted to US dollars, and
        the credit is reversed if the purchase is refunded. Earnings are paid by PayPal once a balance reaches{" "}
        {minimum}, to the address given on the referrals page. A purchase on your own account earns nothing, and
        neither does a link spread by spam, by paid clicks, or with claims about the service that are not true; we may
        withhold earnings and close an account over any of those. The rate may change for future purchases, and never
        for ones already made.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        We may update this page. The date at the top says when it last changed, and continuing to use the service after
        that means the new version applies.
      </p>

      <h2>11. Contact</h2>
      <p>
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>
      </p>
    </Doc>
  );
}
