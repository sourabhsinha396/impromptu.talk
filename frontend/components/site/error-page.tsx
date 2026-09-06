import { Button } from "@/components/site/button";

/* The one page for every error a visitor can be shown: a dead URL, a 500.
   The page the whole SEO plan rests on is /genre/[slug], and a slug that no
   longer exists is the normal way to arrive here: a genre gets merged, a
   link rots, somebody types it. So this page does not apologise at length.
   It says the one true thing and then puts the tool back in front of the
   visitor, because the only useful next step from a dead link is a live
   topic. The status is kept: a soft 404 answering 200 gets the dead URL
   indexed, which is worse than the blob was. */
export function ErrorPage({
  status,
  headline,
  hint,
  retry,
}: {
  status: number;
  headline: string;
  hint: string;
  retry?: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-[clamp(16px,4vw,32px)] pt-16 pb-16">
      <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{status}</p>
      <h1 className="mt-2 font-display text-headline">{headline}</h1>
      <p className="mt-3 max-w-[620px] text-muted">{hint}</p>
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button href="/" size="xl">
          Give me a topic
        </Button>
        {retry ? (
          <Button variant="ghost" onClick={retry}>
            Try again
          </Button>
        ) : (
          <Button variant="ghost" href="/genres">
            Browse the genres
          </Button>
        )}
      </div>
    </main>
  );
}
