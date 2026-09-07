import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: "One inbox for bugs, topic suggestions, refunds and privacy requests, and a chat bubble for short questions.",
  path: "/contact",
});

/* A mailto and the chat bubble, and no form. A form needs a mail
   service, spam handling and somewhere to keep what strangers type, and
   none of that would make a reply arrive any sooner. What it would add
   is a second way for a message to be lost. */
export default function ContactRoute() {
  return (
    <Doc label="Contact us" headline="Write to us.">
      <p>
        One inbox, read by a person: <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. We usually reply within
        two working days.
      </p>

      <h2>Faster than email</h2>
      <p>The chat bubble in the corner of every page is the quickest way to ask something short.</p>

      <h2>What to put in it</h2>
      <ul>
        <li>
          For a refund: the address used at checkout and the date of the payment. The{" "}
          <A href="/refunds">refund policy</A> says what happens next.
        </li>
        <li>For a bug: what you pressed, and what happened instead of what you expected.</li>
        <li>For a topic that should not be in the bank: the words, so it can be found and switched off.</li>
        <li>
          For anything about your data: what you want removed. The <A href="/privacy">privacy policy</A> says what is
          held.
        </li>
      </ul>

      <p>
        There is no contact form on this page on purpose. A form needs a mail service, spam handling and somewhere to
        store what strangers type, and none of that would get you an answer sooner.
      </p>
    </Doc>
  );
}
