import { redirect } from "next/navigation";

import { Round } from "@/components/round/round";
import { currentUser, fetchBank, fetchMine, fetchSharedGenre } from "@/lib/api";
import { featurePath, isRead } from "@/lib/bank";
import { isOwnSlug, withOwn, withShared } from "@/lib/owned";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { jsonLd, webApplication } from "@/lib/structured-data";

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/* The page is the tool. The bank arrives with it, whole, so a respin costs
   no round trip, and the round takes it from there. Somebody's own genres
   are folded into that same payload: one row shape, and the round cannot
   tell a topic of theirs from a topic of ours. */
export default async function Home({ searchParams }: Search) {
  const [params, builtIn, user] = await Promise.all([searchParams, fetchBank(), currentUser()]);
  const wanted = typeof params.genre === "string" ? params.genre : "";
  /* A warm-up has a page of its own and does not run here, so a link that
     names one is sent there rather than opening a spoken round on a genre
     whose bank home does not carry. Kept working rather than 404ed: the
     shape `/?genre=` is how every other genre is linked, and somebody who
     guesses it should land somewhere right. */
  const feature = builtIn.genres.find((genre) => genre.slug === wanted && isRead(genre));
  if (feature) redirect(featurePath(feature.slug));

  const mine = user ? await fetchMine() : null;
  let bank = mine ? withOwn(builtIn, mine.genres) : builtIn;

  /* A link somebody was sent: `?genre=<token>` names a genre that is not
     in this bank and not this account's. It is fetched and folded in for
     this visit only, so the round starts in it without an account and
     without anything being copied. */
  if (wanted && !isOwnSlug(wanted) && !bank.genres.some((genre) => genre.slug === wanted)) {
    const shared = await fetchSharedGenre(wanted);
    if (shared) bank = withShared(bank, shared);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(webApplication(SITE_NAME, SITE_DESCRIPTION)) }}
      />
      <Round bank={bank} signedIn={user !== null} isPro={user?.is_pro ?? false} ownCap={mine?.max_genres} />
    </>
  );
}
