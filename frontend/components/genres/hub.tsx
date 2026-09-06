import Link from "next/link";

import { Button } from "@/components/site/button";
import { GenreIcon } from "@/components/site/icons";
import type { Bank } from "@/lib/bank";
import { topicCounts } from "@/lib/bank";

/* The hub, as approved in docs/mocks/genres.html: ten cards with the count
   on each so the page says what it holds before anybody clicks, and one
   button into the tool. It is load-bearing for the crawl: every genre
   page is one hop from here, and the footer links here rather than to
   six genres. */
export function Hub({ bank }: { bank: Bank }) {
  const counts = topicCounts(bank);
  const total = bank.topics.length;
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <h1 className="font-display text-headline font-semibold">Ten genres, {total} topics.</h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
        Pick what you want to talk about. Every genre has every style, so a hot take and a story are always one
        setting away.
      </p>
      <div className="mt-6">
        <Button href="/" size="xl">
          Spin
        </Button>
      </div>
      <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
        {bank.genres.map((genre) => (
          <Link
            key={genre.slug}
            href={`/genre/${genre.slug}`}
            className="block rounded-card border border-line bg-card px-4.5 pt-4.5 pb-4 text-ink no-underline transition-colors hover:border-accent"
          >
            <GenreIcon icon={genre.icon} size={22} className="text-accent" />
            <span className="mt-2.5 block text-base font-semibold">{genre.name}</span>
            <span className="mt-1 block text-[13px] leading-[1.45] text-muted">{genre.blurb}</span>
            <span className="mt-2.5 block text-xs font-semibold text-muted">{counts[genre.slug] ?? 0} topics</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
