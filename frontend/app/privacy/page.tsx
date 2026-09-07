import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What impromptu.talk stores and what it does not: no microphone, no uploads, and prep notes that never leave your browser.",
  path: "/privacy",
});

/* Written against what the code actually does - the five cookies, the
   runs table, the PostHog init, the generations table. If any of those
   change, this page changes in the same commit. */
export default function PrivacyRoute() {
  return (
    <Doc label="Privacy policy" headline="Almost nothing." updated="7 September 2026">
      <p>
        You can use everything here without an account, and most people should: no name, no address, nothing to lose.
        An account is optional and exists to carry your streak between devices. This page says exactly what is stored,
        where, and how to be rid of it.
      </p>

      <h2>What never leaves your browser</h2>
      <ul>
        <li>
          <b>Your prep notes.</b> What you type in the thinking minute is never sent anywhere. It lives in the page and
          is gone when you close it.
        </li>
        <li>
          <b>Your settings.</b> Genre, style, prep and speaking lengths, sound and theme are kept in your
          browser&rsquo;s local storage.
        </li>
        <li>
          <b>Your voice.</b> The tool never asks for your microphone and never records anything.
        </li>
      </ul>

      <h2>What we store if you make an account</h2>
      <p>
        Only what signing in needs: your email address, and your password put through a one-way hash we cannot read
        back. Making an account attaches the rounds already recorded in this browser to it, so a streak built
        anonymously is not thrown away. Signing in with Google stores the identifier Google gives us instead of a
        password, and no more of your Google account than the address and the name on it.
      </p>
      <p>
        If you arrived through somebody&rsquo;s <A href="/affiliate">affiliate link</A>, the account records who sent
        you so that they can be paid. If you use your own link, we store the PayPal address you give us to send
        earnings to, and nothing else about it.
      </p>

      <h2>What we store when you finish a round</h2>
      <p>When a round ends, one row is written on our server:</p>
      <ul>
        <li>the topic text and its genre;</li>
        <li>how long the prep and speaking phases were set to, and how long you actually spoke;</li>
        <li>the time it finished, and how far your clock is from ours, so a day means your day;</li>
        <li>an anonymous device id.</li>
      </ul>
      <p>
        That is the whole row. It exists for one reason: a streak has to be counted from somewhere, and counting it on
        the server is what lets it survive a browser cache being cleared.
      </p>

      <h2>The cookies</h2>
      <p>There are five, and none of them is an advertising cookie.</p>
      <ul>
        <li>
          <b>The device id.</b> A random id set the first time you arrive, in an <code>HttpOnly</code> cookie scripts
          on the page cannot read. It is not linked to a name, an address or an IP profile, and it is the only thing
          that ties your rounds together into a streak.
        </li>
        <li>
          <b>Your session</b>, once you sign in, so that the next page knows it is you.
        </li>
        <li>
          <b>The referral code</b>, for 60 days, if you arrived through a link ending in <code>?ref=</code> and a word.
          It identifies the affiliate who sent you, never you, and it is read twice: if you make an account, and if you
          buy Pro. Without either it does nothing at all and expires on its own.
        </li>
        <li>
          <b>Your timezone</b> and <b>the currency you picked</b>, so a day is your day and a price is in the money you
          asked for.
        </li>
      </ul>
      <p>
        Clear this site&rsquo;s cookies and you become a new, unrelated visitor - and your streak starts again, which
        is the honest trade for not asking you to sign up.
      </p>

      <h2>Sharing, when you choose it</h2>
      <p>
        A shared streak page and a shared genre are both off until you turn them on, and both show the name on your
        account if you gave one - never your email address. Turning sharing off kills the link at once, and sharing
        again makes a new one.
      </p>

      <h2>Writing topics with a model</h2>
      <p>
        Pro can write topics from a sentence you type. That sentence is sent to the model provider that answers it, and
        we keep the sentence, which model answered, how many topics came back and what it cost. Nothing else about your
        account goes with it, and the feature is only ever used when you press the button.
      </p>

      <h2>Analytics</h2>
      <p>
        We use <A href="https://posthog.com/">PostHog</A> to count how many people finish a round and how many come
        back the next day. It runs on the live site only - never on a laptop or a staging copy - and it is configured
        deliberately narrowly:
      </p>
      <ul>
        <li>autocapture is off, so the contents of inputs and the labels you click are never collected;</li>
        <li>
          session recording is on, so the pages you move through are filmed, but everything you type is masked before
          the recording leaves your browser, and your prep notes are masked twice over: as you write them, and again
          where they are shown back to you during the speaking minute;
        </li>
        <li>events carry the settings a round was run with - genre, style, lengths - and never what you wrote.</li>
      </ul>
      <p>
        PostHog is identified with the same anonymous device id. If you have an account, your email address is attached
        to that id, so a recording can be matched to you when you write to us about a problem; without an account
        nothing there is linked to a name or an address, and that is the ordinary way to use this site. If you block
        analytics, everything works exactly as before.
      </p>

      <h2>Who else can see it</h2>
      <p>
        The people who keep the site running: our hosting provider, PostHog as described above, Crisp for the chat
        bubble, Brevo for the handful of emails we send, and Dodo Payments for a purchase - they are the merchant of
        record and we never see or store your card details. Nobody else, unless the law requires it. An affiliate whose
        link you followed sees that an account was made and what it bought, never your name or your address.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>No advertising, and no advertising trackers.</li>
        <li>No selling or renting of data. There is nothing here worth buying.</li>
        <li>No profiling across other sites.</li>
        <li>No marketing email.</li>
      </ul>

      <h2>Children</h2>
      <p>
        The tool is suitable for classroom use and collects no personal details from anyone, of any age, without an
        account. It is not directed at children under 13 and we do not knowingly hold information that could identify
        one.
      </p>

      <h2>Your rights</h2>
      <p>
        You can remove everything held about you by clearing this site&rsquo;s cookies and site data, which severs the
        only link between you and the rows on our side. To have those rows deleted outright, or to ask what is held,
        write to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> and quote the date and rough time of a round
        so it can be found.
      </p>

      <h2>Changes</h2>
      <p>
        If what is collected ever changes, this page changes with it and the date at the top moves. Questions go to{" "}
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. {SITE_NAME} is run from India.
      </p>
    </Doc>
  );
}
