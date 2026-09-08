import type { Metadata } from "next";

import { Button } from "@/components/site/button";
import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "What yapholic.com is: a random topic, a minute to think, a minute to talk. Free, no account, a thousand topics across ten genres.",
  path: "/about",
});

/* The page a curious visitor from a reel lands on. The numbers here are
   v1's own: v0's about page said 800 topics across 20 genres and was
   already wrong the day it shipped, which is the argument for keeping
   the count in one sentence rather than in four. */
export default function AboutRoute() {
  return (
    <Doc name="About">
      <p>
        {SITE_NAME} is a practice tool for speaking without preparation. You press one button, a topic you did not
        choose appears, and you get a minute to think and a minute to talk.
      </p>

      <h2>Why it exists</h2>
      <p>
        Speaking off the cuff improves with repetition, and repetition is hard to arrange alone, because the difficult
        part is being handed a subject you would not have chosen. The topic is random for that reason: choosing your
        own removes the difficulty you came to practise.
      </p>

      <h2>What it includes</h2>
      <ul>
        <li>
          A thousand topics across <A href="/genres">ten genres</A>, covering everyday life, work and interviews,
          money, technology, science, health, philosophy and culture.
        </li>
        <li>Four styles, so the same topic can be an open answer, an argument, an explanation or a story.</li>
        <li>Prep and speaking lengths you can change, set to a minute each by default.</li>
        <li>A streak counted from completed rounds, which works before you have an account.</li>
      </ul>

      <h2>What it costs</h2>
      <p>
        The round, the topic bank and a five day streak are free, with no registration required. An account is optional
        and carries your streak between devices.
      </p>
      <p>
        <A href="/pro">Pro</A> is the paid tier. It retains your full practice history, allows you to write your own
        genres, and unlocks the accent colours.
      </p>

      <h2>Who runs it</h2>
      <p>
        An independent project, built and run by one person. Bugs, topic suggestions and complaints all reach the same
        address: <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. See <A href="/contact">contact</A>.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button href="/">Try a topic</Button>
        <Button href="/genres" variant="ghost">
          Browse the genres
        </Button>
      </div>
    </Doc>
  );
}
