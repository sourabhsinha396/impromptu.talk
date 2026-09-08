import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What yapholic.com stores, why, who else can see it, and how to have it removed.",
  path: "/privacy",
});

/* Written against what the code actually does - the five cookies, the
   runs table, the PostHog init, the generations table. If any of those
   change, this page changes in the same commit. */
export default function PrivacyRoute() {
  return (
    <Doc name="Privacy Policy" updated="7 September 2026">
      <p>
        This page states what {SITE_NAME} stores, where, who else can access it, and how to have it removed.
      </p>

      <h2>What stays in your browser</h2>
      <ul>
        <li>
          <b>Prep notes.</b> What you type during the thinking minute is never sent to us. It stays in the page and is
          discarded when you close it.
        </li>
        <li>
          <b>Settings.</b> Genre, style, prep and speaking lengths, sound and theme are stored in your browser&rsquo;s
          local storage.
        </li>
        <li>
          <b>Audio.</b> The tool does not request microphone access and does not record anything.
        </li>
      </ul>

      <h2>What we store if you create an account</h2>
      <p>
        Your email address, and your password stored as a one-way hash that cannot be read back. Creating an account
        attaches the rounds already recorded in that browser to it, so a streak built without an account is not lost.
        Signing in with Google stores the identifier Google provides in place of a password, along with the email
        address and name on that Google account.
      </p>
      <p>
        If you arrived through an <A href="/affiliate">affiliate link</A>, the account records who referred you so that
        they can be credited. If you use your own affiliate link, we store the PayPal address you provide for payouts.
      </p>

      <h2>What we store when you finish a round</h2>
      <p>One row is written on our server, containing:</p>
      <ul>
        <li>the topic text and its genre;</li>
        <li>the prep and speaking lengths that were set, and how long you actually spoke;</li>
        <li>the time it finished, and your timezone offset, so that a day means your day;</li>
        <li>an anonymous device identifier.</li>
      </ul>
      <p>
        That is the entire row. It exists so that a streak can be counted on the server and survive a browser cache
        being cleared.
      </p>

      <h2>Cookies</h2>
      <p>Five cookies are used, and none of them is for advertising.</p>
      <ul>
        <li>
          <b>Device identifier.</b> A random value set on your first visit, in an <code>HttpOnly</code> cookie that
          page scripts cannot read. It is not linked to a name, an address or an IP-based profile, and it is what ties
          your rounds together into a streak.
        </li>
        <li>
          <b>Session.</b> Set when you sign in, so that subsequent requests are recognised.
        </li>
        <li>
          <b>Referral code.</b> Set for 60 days if you arrive through a link ending in <code>?ref=</code> and a code. It
          identifies the affiliate who referred you, not you, and is read only when an account is created or a purchase
          is made. It expires on its own.
        </li>
        <li>
          <b>Timezone</b> and <b>currency</b>, so that a day is counted in your timezone and prices are shown in the
          currency you selected.
        </li>
      </ul>
      <p>
        Clearing this site&rsquo;s cookies makes you a new, unrelated visitor, and an anonymous streak starts again.
      </p>

      <h2>Sharing</h2>
      <p>
        A shared streak page and a shared genre are both off by default. When enabled, each shows the name on your
        account if you have provided one, and never your email address. Disabling sharing invalidates the existing link
        immediately; enabling it again creates a new one.
      </p>

      <h2>Generating topics</h2>
      <p>
        Pro can generate topics from a prompt you write. That prompt is sent to the model provider that answers it. We
        store the prompt, which model answered, how many topics were returned and the token counts. No other
        information about your account is sent, and the feature runs only when you use it.
      </p>

      <h2>Reading a round back</h2>
      <p>
        With Pro, what you said in a round is sent once to a model provider, which answers with whether you did what the
        topic asked and one thing to try next time. That answer is stored with the round. Nothing about your account is
        sent with it, and it happens only for rounds you record.
      </p>

      <h2>Analytics</h2>
      <p>
        We use <A href="https://posthog.com/">PostHog</A> to measure how many people complete a round and how many
        return. It runs on the live site only, and is configured narrowly:
      </p>
      <ul>
        <li>autocapture is disabled, so the contents of inputs and the labels you click are not collected;</li>
        <li>
          session recording is enabled, so the pages you visit are recorded, but text you type is masked before the
          recording leaves your browser, and prep notes are masked both as they are written and where they are shown
          back to you;
        </li>
        <li>events carry the settings a round was run with - genre, style, lengths - and never what you wrote.</li>
      </ul>
      <p>
        PostHog is identified with the same anonymous device identifier. If you have an account, your email address is
        associated with that identifier so that a recording can be matched to you if you contact us about a problem.
        Blocking analytics does not affect how the site works.
      </p>

      <h2>Who else can access it</h2>
      <p>
        Our hosting provider, PostHog as described above, Crisp for the chat widget, Brevo for transactional email, and
        Dodo Payments for purchases - they are the merchant of record, and we neither see nor store card details. No
        one else, unless required by law. An affiliate whose link you followed can see that an account was created and
        what it purchased, and never your name or email address.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>No advertising, and no advertising trackers.</li>
        <li>No sale or rental of personal data.</li>
        <li>No profiling across other sites.</li>
        <li>No marketing email.</li>
      </ul>

      <h2>Children</h2>
      <p>
        The tool is suitable for classroom use and collects no personal details from anyone without an account. It is
        not directed at children under 13, and we do not knowingly hold information that could identify one.
      </p>

      <h2>Your rights</h2>
      <p>
        Clearing this site&rsquo;s cookies and site data removes the link between you and the rows stored on our side.
        To have those rows deleted, or to request a copy of what is held, write to{" "}
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>, including the date and approximate time of a round so
        that it can be located.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If what is collected changes, this page is updated and the date at the top changes with it. Questions go to{" "}
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. {SITE_NAME} is operated from India.
      </p>
    </Doc>
  );
}
