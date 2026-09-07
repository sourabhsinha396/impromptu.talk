import { RoundReport } from "@/components/round/report";
import { Button } from "@/components/site/button";
import { GenreIcon } from "@/components/site/icons";
import type { Bank } from "@/lib/bank";
import type { Report } from "@/lib/report";

/* One past round, read back.

   Everything here has been stored since the report shipped and none of it
   was reachable: the report was drawn once on the done screen and then
   gone, while Pro was sold on keeping exactly this. The page is the same
   `RoundReport` the done screen draws, so a round looks the same the day
   after as it did the moment it ended, and there is one component to keep
   right rather than two that drift.

   The topic is the headline, because that is what somebody is looking for
   when they come back: they remember the prompt, not the date. */
export function PastRound({ report, bank, signedIn }: { report: Report; bank: Bank; signedIn: boolean }) {
  const genre = bank.genres.find((candidate) => candidate.slug === report.genre_slug);
  const when = new Date(report.at);

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-muted">
        <a href="/streak" className="underline underline-offset-4 hover:text-ink">
          Your streak
        </a>
        <span aria-hidden>/</span>
        <time dateTime={report.at}>
          {when.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
        </time>
        {genre && (
          <span className="inline-flex items-center gap-1">
            <GenreIcon icon={genre.icon} size={14} className="text-accent" />
            {genre.name}
          </span>
        )}
      </p>

      <h1 className="font-display text-[clamp(1.6rem,4vw,2.2rem)] font-semibold tracking-[-0.03em]">{report.topic}</h1>

      <div className="mt-8">
        <RoundReport report={report} length={Math.max(1, Math.round(report.speaking_seconds + totalGaps(report)))} />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {/* The topic again, not the tool's front door: somebody who has
            just read what they said about one prompt most often wants
            another go at that prompt. */}
        <Button href={`/?topic=${encodeURIComponent(slugFor(report, bank))}`} size="lg">
          Try this one again
        </Button>
        <Button href="/streak" size="lg" variant="ghost">
          Back to your streak
        </Button>
      </div>

      {!signedIn && (
        <p className="mt-8 max-w-[52ch] text-sm text-muted">
          Saved on this device only.{" "}
          <a href="/signup" className="font-semibold text-accent-strong underline underline-offset-4">
            Keep it with an account
          </a>
          .
        </p>
      )}
    </main>
  );
}

/* The round's own length, rebuilt from what is stored: the sound plus the
   silences between. The bar needs a scale and the run's clock is not on
   the report, so it is derived rather than carried. */
function totalGaps(report: Report): number {
  return report.opening_stall + report.pauses.reduce((total, pause) => total + pause.seconds, 0);
}

/* The bank topic whose text this was, so "try again" opens the same
   prompt. A line somebody wrote in their own genre has no slug here and
   falls back to a plain spin, which is the honest thing rather than a
   link that 404s. */
function slugFor(report: Report, bank: Bank): string {
  return bank.topics.find((topic) => topic.text === report.topic)?.slug ?? "";
}
