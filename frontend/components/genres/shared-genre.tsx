import { Button } from "@/components/site/button";
import { GenreIcon } from "@/components/site/icons";
import type { SharedGenre } from "@/lib/owned";
import { SITE_DESCRIPTION } from "@/lib/site";

/* Somebody else's genre, seen by whoever holds the link, as approved in
   docs/mocks/yours.html. No account, no ids, nothing copied: the page
   reads the list as it is now, so an edit reaches everybody holding the
   link. One button, into a round in this genre. */
export function SharedGenrePage({ shared }: { shared: SharedGenre }) {
  const whose = shared.owner_name ? `${shared.owner_name}'s genre` : "A shared genre";
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <h1 className="flex items-center gap-3 font-display text-headline font-semibold">
        <GenreIcon icon={shared.icon} size={30} className="flex-none text-accent" />
        {shared.name}
      </h1>
      <p className="mt-3 mb-5 text-sm text-muted">
        {whose} · {shared.topics.length} topics
      </p>
      <Button href={`/?genre=${encodeURIComponent(shared.token)}`} size="xl">
        Practise this
      </Button>
      <ul className="mt-4.5 list-none p-0">
        {shared.topics.map((topic) => (
          <li key={topic.id} className="flex items-center gap-3 border-b border-line px-1 py-2.5">
            <span className="min-w-0 flex-1 text-[15.5px]">{topic.text}</span>
            <span className="rounded-full border border-line bg-card2 px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">
              {topic.style_label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-7.5 max-w-[60ch] text-[17px] text-muted">
        {SITE_DESCRIPTION}{" "}
        <a href="/genres/yours" className="text-accent-strong no-underline hover:underline">
          Make your own
        </a>
        .
      </p>
    </main>
  );
}
