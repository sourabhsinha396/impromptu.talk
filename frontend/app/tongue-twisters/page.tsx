import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Round } from "@/components/round/round";
import { MakeYourOwn } from "@/components/round/make-your-own";
import { currentUser, fetchMine, fetchReadGenre } from "@/lib/api";
import { passagesByDifficulty, type Bank } from "@/lib/bank";
import { isOwnRead, withOwn } from "@/lib/owned";
import { pageMetadata } from "@/lib/metadata";
import { itemList, jsonLd } from "@/lib/structured-data";

/* Tongue twisters: a feature with a URL of its own, which is the rule from
   here on (docs/DECISIONS.md). Home is the tool and stays the genre chip,
   the question and one button; anything that changes what the round *is*
   takes a page rather than a mode on that screen. Three things follow, and
   every one of them was a problem before this page took the round:

   - a crawler has somewhere to land, and the URL survives being typed into
     a comment reply, which is visibly where the demand is;
   - the settings here are this feature's own, so home's sheet never
     becomes the control panel for every mode the site grows. On home's
     sheet a warm-up left five of six controls doing nothing;
   - the bank is server-rendered here rather than fetched, so the round
     starts with its passages already in hand and costs no round trip.

   The passages are the page's content and the round's bank at once, which
   is what makes the third point free. */
const SLUG = "tongue-twisters";

const TITLE = "Tongue twisters";
const HEAD = "Tongue twisters to read out loud";
const DESCRIPTION =
  "Long tongue twisters, written to be read aloud without stopping. Put one on a scroller and try to keep up. Free, no account.";
const LEDE = "";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: HEAD, description: DESCRIPTION, path: `/${SLUG}` });
}

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Search) {
  const [params, genre, user] = await Promise.all([searchParams, fetchReadGenre(SLUG), currentUser()]);
  /* A 404 rather than an empty page when the backend is unreachable: a page
     promising tongue twisters and listing none is worse than a dead URL,
     and an indexed empty page is harder to undo than a missed crawl. */
  if (!genre || !genre.passages.length) notFound();

  /* One genre and its passages, which is the whole bank this page needs.
     No styles: nobody chooses how to say words they are reading verbatim,
     and the one axis a passage does have rides in `level`, its own key on
     its own column on its own table (docs/DECISIONS.md). */
  const own: Bank = {
    genres: [{ slug: genre.slug, name: genre.name, icon: genre.icon, blurb: genre.blurb, mode: "read" }],
    topics: genre.passages.map((passage) => ({
      text: passage.text,
      genre: genre.slug,
      level: passage.level,
      slug: passage.slug,
    })),
    styles: [],
  };

  /* The visitor's own warm-ups ride in the same bank, so choosing them in
     settings is a filter rather than a second page: it narrows what a spin
     lands on, exactly as home's genre picker does, and it does not change
     what the round is. Only their read genres are folded in - a genre of
     one-line prompts has nothing to scroll. */
  const mine = user ? await fetchMine() : null;
  const bank = mine ? withOwn(own, mine.genres.filter(isOwnRead)) : own;

  /* The passage the page opens on, chosen here so the first paint is the
     tool. A link that names one wins; otherwise it is a fresh draw per
     request, which is what keeps a page somebody reloads from handing back
     the same passage every time. */
  const asked = typeof params.topic === "string" ? params.topic : "";
  const pool = own.topics;
  const opening = bank.topics.find((topic) => topic.slug === asked) ?? pool[Math.floor(Math.random() * pool.length)];

  const groups = passagesByDifficulty(genre);
  const data = itemList(
    HEAD,
    DESCRIPTION,
    `/${SLUG}`,
    genre.passages.map((passage) => passage.text),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <Round
        bank={bank}
        signedIn={user !== null}
        isPro={user?.is_pro ?? false}
        feature={{ slug: SLUG, title: TITLE, lede: LEDE }}
        initialTopic={opening}
      >
        {/* Every passage in full as plain text, which is the rule that makes
            the ten genre pages rank and is the same rule here. It sits
            below the button while the page is idle and is gone once a
            round starts, because by then the screen belongs to the words. */}
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`level-${group.label}`}>
            <h2
              id={`level-${group.label}`}
              className="mt-9 mb-1 text-[15px] font-semibold tracking-[0.04em] text-muted uppercase"
            >
              {group.label}
            </h2>
            {group.passages.map((passage) => (
              <article key={passage.slug} className="border-t border-line pt-[18px] pb-1">
                <p className="mb-2 text-[12.5px] font-semibold tracking-[0.02em] text-muted">
                  {passage.words} words &middot; about {Math.round((passage.words / 150) * 60)} seconds
                </p>
                <p className="m-0 text-[16.5px] leading-[1.62] break-words">{passage.text}</p>
              </article>
            ))}
          </section>
        ))}
        <MakeYourOwn signedIn={user !== null} isPro={user?.is_pro ?? false} path="/pro/custom-tongue-twisters" />
      </Round>
    </>
  );
}
