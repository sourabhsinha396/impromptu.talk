import Link from "next/link";

import { Button } from "@/components/site/button";
import { GenreIcon, StyleIcon } from "@/components/site/icons";
import type { Bank, Genre } from "@/lib/bank";
import { topicsByStyle } from "@/lib/bank";

/* A genre page, as approved in docs/mocks/genres.html. It is the crawlable
   unit: a topic has no page of its own, so every one of them is plain
   text here, grouped by style under real headings so the page reads as a
   document about the subject rather than a flat list with a tag on every
   line. The one button opens the tool with the genre picked. */
export function GenrePage({ bank, genre }: { bank: Bank; genre: Genre }) {
  const groups = topicsByStyle(bank, genre.slug);
  const total = groups.reduce((sum, group) => sum + group.topics.length, 0);
  const siblings = bank.genres.filter((other) => other.slug !== genre.slug);
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-3.5 text-[13px] font-semibold text-muted">
        <Link href="/genres" className="no-underline hover:text-ink">
          All genres
        </Link>{" "}
        / {genre.name}
      </p>
      <h1 className="flex items-center gap-3 font-display text-headline font-semibold">
        <GenreIcon icon={genre.icon} size={34} className="shrink-0 text-accent" />
        {genre.name} speaking topics
      </h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
        {genre.blurb} {total} topics across four styles; a minute to think, a minute to talk.
      </p>
      <div className="mt-5">
        <Button href={`/?genre=${genre.slug}`} size="xl">
          Practise this genre
        </Button>
      </div>

      {groups.map((group) => (
        <section key={group.style.key} aria-labelledby={`style-${group.style.key}`}>
          <h2 id={`style-${group.style.key}`} className="mt-8 mb-2.5 flex items-center gap-2.5 text-[15px] font-semibold">
            <StyleIcon style={group.style.key} size={18} className="text-accent" />
            {group.style.label}
            <span className="text-[13px] text-muted">
              {group.topics.length} of {total}
            </span>
          </h2>
          <ul className="columns-1 gap-8 sm:columns-2">
            {group.topics.map((topic) => (
              <li key={topic.slug} className="border-b border-line px-0.5 py-2 text-[15.5px] break-inside-avoid">
                {topic.text}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-9 text-[13px] font-semibold text-muted">More genres</p>
      <nav aria-label="More genres" className="mt-2 flex flex-wrap gap-2">
        {siblings.map((other) => (
          <Link
            key={other.slug}
            href={`/genre/${other.slug}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-card2 pr-3.5 pl-3 text-sm font-semibold text-ink no-underline transition-colors hover:border-accent"
          >
            <GenreIcon icon={other.icon} className="text-accent" />
            {other.name}
          </Link>
        ))}
      </nav>
    </main>
  );
}
