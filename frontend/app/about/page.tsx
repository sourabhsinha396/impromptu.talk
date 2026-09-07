import type { Metadata } from "next";

import { Button } from "@/components/site/button";
import { A, Doc } from "@/components/site/doc";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About us",
  description:
    "Why impromptu.talk exists: one random topic, a minute to think, a minute to talk. Free, no account, a thousand topics across ten genres.",
  path: "/about",
});

/* The page a curious visitor from a reel lands on. The numbers here are
   v1's own: v0's about page said 800 topics across 20 genres and was
   already wrong the day it shipped, which is the argument for keeping
   the count in one sentence rather than in four. */
export default function AboutRoute() {
  return (
    <Doc label="About us" headline="One topic you did not choose.">
      <p>
        {SITE_NAME} is a practice tool for speaking off the cuff. You press one button, a topic you did not pick lands
        in front of you, and you get a minute to think and a minute to talk. That is the whole product.
      </p>

      <h2>Why it exists</h2>
      <p>
        Most people are not bad at speaking. The fix is reps, and reps are hard to get alone, because the hard part is
        being handed a subject you would never have chosen.
      </p>
      <p>So the topic is random on purpose. Choosing your own quietly removes the difficulty you came to practise.</p>

      <h2>How it works</h2>
      <ul>
        <li>
          A thousand topics across <A href="/genres">ten genres</A>: everyday life, work and interviews, money, tech,
          science, health, philosophy and culture.
        </li>
        <li>Four styles. The same topic can be an open answer, a hot take, an explanation or a story.</li>
        <li>Prep and speaking lengths you can change, a minute each to start.</li>
        <li>A streak, counted from the rounds you finish, that starts before you have an account.</li>
      </ul>

      <h2>What it costs</h2>
      <p>
        Nothing, for the part you came for. There is no sign-up wall and no trial: an account is optional and carries
        your streak between devices.
      </p>
      <p>
        One thing is paid. <A href="/pro">Pro</A> keeps your whole history rather than the last few days, lets you
        write <A href="/genres/yours">your own genres</A> and colours the page.
      </p>

      <h2>Who made it</h2>
      <p>
        A small independent project, built and run by one person. Bugs, topic suggestions and complaints land in the
        same inbox: <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>. More on{" "}
        <A href="/contact">the contact page</A>.
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
