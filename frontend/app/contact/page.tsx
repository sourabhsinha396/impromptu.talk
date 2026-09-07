import type { Metadata } from "next";

import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "One inbox for bugs, topic suggestions, refunds and privacy requests, and a chat bubble for short questions.",
  path: "/contact",
});

/* A mailto and the chat bubble, and no form. A form needs a mail
   service, spam handling and somewhere to keep what strangers type, and
   none of that would make a reply arrive any sooner. What it would add
   is a second way for a message to be lost. */
export default function ContactRoute() {
  return (
    <Doc name="Contact">
      <p>
        Email <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> for anything: bugs, topic suggestions, refunds,
        privacy requests. Replies usually take up to two working days.
      </p>

      <h2>Chat</h2>
      <p>The chat widget in the corner of every page is the quickest way to ask something short.</p>
    </Doc>
  );
}
