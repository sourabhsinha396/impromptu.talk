import Link from "next/link";

import { Stats } from "@/components/round/phases";
import { Button } from "@/components/site/button";
import { FlameIcon } from "@/components/site/icons";
import { Calendar, Section } from "@/components/streak/streak-page";
import { type Shared } from "@/lib/practice";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/* One person's practice for anybody with the link, as approved in
   docs/mocks/share.html: the streak page's shape seen by a stranger. The
   name if they gave one, never the email. No pitch, no times, no footer
   line: nothing about the owner but the work. Only bank topics are named,
   each a link into a round on that exact prompt. Somebody arrived because
   a person they know is doing this, which is a better pitch than any copy,
   so one button and the tagline is all that follows. */
export function SharedPage({ shared }: { shared: Shared }) {
  const who = shared.name || "A speaker";
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-1.5 text-[13px] font-semibold text-muted">
        {who} on {SITE_NAME}
      </p>
      <h1 className="flex items-center gap-[0.18em] font-display text-headline font-semibold">
        {shared.streak > 0 && <FlameIcon className="size-[0.8em] shrink-0 text-accent" />}
        {shared.streak > 0 ? `Day ${shared.streak}.` : "Just getting started."}
      </h1>

      <div className="mt-6 max-w-[760px]">
        <Stats streak={shared.streak} topics={shared.topics} minutes={shared.minutes} />
      </div>

      <Section title="Last eight weeks" aside={null}>
        <Calendar days={shared.calendar} window={shared.days} />
      </Section>

      {shared.recent.length > 0 && (
        <Section title="Recently practised" aside={null}>
          <ul className="sm:columns-2 sm:gap-x-12">
            {shared.recent.map((topic) => (
              <li key={topic.slug} className="break-inside-avoid border-b border-line px-0.5 py-2.5 text-[15.5px]">
                <Link href={`/?topic=${topic.slug}`} className="text-ink no-underline hover:text-accent hover:underline">
                  {topic.text}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-9">
        <Button href="/" size="xl">
          Try one yourself
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">{SITE_TAGLINE} No account needed.</p>
    </main>
  );
}
