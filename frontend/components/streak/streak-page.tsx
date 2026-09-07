import Link from "next/link";

import { Stats } from "@/components/round/phases";
import { Button } from "@/components/site/button";
import { FlameIcon, GenreIcon } from "@/components/site/icons";
import type { SessionUser } from "@/lib/api";
import type { Bank } from "@/lib/bank";
import { type Day, type History, heatmapLayout, isStrip, timeAgo, weekdayName, windowLabel } from "@/lib/practice";

/* The streak page, as approved in docs/mocks/streak.html. One column at
   960px, the genre page's frame. The tiles are the done screen's, so the
   page the flame opens looks like the screen that sent you. Every window
   is the plan's number, never the template's, and every line of copy is
   one short sentence. */
export function StreakPage({
  history,
  bank,
  user,
  now = Date.now(),
}: {
  history: History;
  bank: Bank;
  user: SessionUser | null;
  now?: number;
}) {
  const pro = user?.is_pro ?? false;
  const hasRuns = history.topics > 0;
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-1.5 text-[13px] font-semibold text-muted">Your streak</p>
      <h1 className="flex items-center gap-[0.18em] font-display text-headline font-semibold">
        {/* The same flame as the pill, which is the only door here: you
            clicked it to get here, it is the first thing here, and it is the
            one place on this page the accent belongs. */}
        {history.streak > 0 && <FlameIcon className="size-[0.8em] shrink-0 text-accent" />}
        {history.streak > 0 ? `Day ${history.streak}.` : "Nothing yet."}
      </h1>

      {hasRuns ? (
        <>
          <div className="mt-6">
            <Stats streak={history.streak} topics={history.topics} minutes={history.minutes} />
          </div>

          <Section
            title={windowLabel(history.days)}
            aside={
              pro ? null : (
                <>
                  Free keeps {history.days} days. <PitchLink>Pro keeps a year</PitchLink>
                </>
              )
            }
          >
            {isStrip(history.days) ? <Strip days={history.calendar} /> : <Heatmap days={history.calendar} />}
          </Section>

          <Section title="Recent" aside={<Capped history={history} pro={pro} />}>
            <RecentList history={history} bank={bank} now={now} />
          </Section>

          <div className="mt-9">
            <Button href="/" size="xl">
              Keep it going
            </Button>
          </div>

          {/* Said only when it is true, and only about what Pro would hold.
              The streak itself is free; nothing here is taken away to sell it. */}
          {!pro && history.would_be > history.streak && (
            <p className="mt-6 max-w-[52ch] text-sm text-muted">
              A missed day ended your last streak. <PitchLink>Pro would have held it at {history.would_be}.</PitchLink>
            </p>
          )}

          <p className="mt-9 max-w-[60ch] text-[13.5px] text-muted">
            {user ? (
              <>Signed in as {user.name || user.email}. Your streak follows you on any device.</>
            ) : (
              <>
                Saved on this device only.{" "}
                <Link href="/signup" className="font-semibold text-ink">
                  Keep it with an account
                </Link>
                .
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3.5 max-w-[48ch] text-base text-muted">Finish a round. It shows up here.</p>
          <div className="mt-8">
            <Button href="/" size="xl">
              Start
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function Section({ title, aside, children }: { title: string; aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside && <p className="text-[13px] font-semibold text-muted">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

function PitchLink({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/pro" className="font-semibold text-accent-strong underline underline-offset-3 dark:text-accent">
      {children}
    </Link>
  );
}

/* Pro lifts the cap rather than removing it, so a Pro speaker past it gets
   the count and no pitch for something they already own. */
function Capped({ history, pro }: { history: History; pro: boolean }) {
  const shown = history.recent.length;
  if (history.topics <= shown) return null;
  return (
    <>
      Last {shown} of {history.topics}.{!pro && <> <PitchLink>Pro keeps them all</PitchLink></>}
    </>
  );
}

/* Five named days you can read from a sofa: today ringed, spoken days
   filled. The free rule is five days, and five squares in a week grid read
   as nothing. */
function Strip({ days }: { days: Day[] }) {
  return (
    <ol className="grid max-w-[520px] gap-2.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((day, index) => {
        const today = index === days.length - 1;
        return (
          <li
            key={day.date}
            title={`${day.date}${day.count ? `, ${day.count} ${day.count === 1 ? "topic" : "topics"}` : ""}`}
            className={`rounded-xl border bg-card px-2 pt-3 pb-2.5 text-center ${today ? "border-line-strong" : "border-line"}`}
          >
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              {today ? "Today" : weekdayName(day.date)}
            </span>
            <span
              className={`mx-auto mt-1.5 block size-7 rounded-lg border ${
                day.count ? "border-accent bg-accent" : "border-line bg-card2"
              }`}
              aria-hidden
            />
          </li>
        );
      })}
    </ol>
  );
}

const CELL = "12px";
const GAP = "3px";

/* A week per column, time left to right, the last column the week you are
   in. The scroll container runs right to left with its content left to
   right, which is how it opens already scrolled to today on a phone with
   no script: the grid ends on today, so the end is the part worth showing.
   A dashed square is a day the freeze held: it did not happen, and a
   square that read as a run would be the calendar telling a small lie. */
function Heatmap({ days }: { days: Day[] }) {
  const layout = heatmapLayout(days.map((day) => day.date));
  const anyFrozen = days.some((day) => day.frozen);
  return (
    <>
      <div className="flex items-start gap-2">
        <div
          className="mt-[17px] grid text-[10px] font-semibold text-muted"
          style={{ gridTemplateRows: `repeat(7, ${CELL})`, gap: GAP, lineHeight: CELL }}
          aria-hidden
        >
          <span style={{ gridRow: 1 }}>Mon</span>
          <span style={{ gridRow: 3 }}>Wed</span>
          <span style={{ gridRow: 5 }}>Fri</span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto [direction:rtl] [scrollbar-width:thin]">
          <div className="w-max [direction:ltr]">
            <div
              className="grid h-3.5 text-[10px] font-semibold whitespace-nowrap text-muted"
              style={{ gridAutoFlow: "column", gridAutoColumns: CELL, gap: GAP }}
              aria-hidden
            >
              {layout.months.map((month) => (
                <span key={`${month.label}-${month.column}`} style={{ gridColumn: month.column }}>
                  {month.label}
                </span>
              ))}
            </div>
            <ol
              className="grid"
              style={{ gridAutoFlow: "column", gridTemplateRows: `repeat(7, ${CELL})`, gridAutoColumns: CELL, gap: GAP }}
            >
              {days.map((day, index) => {
                const today = index === days.length - 1;
                const fill = day.count
                  ? "border-accent bg-accent"
                  : day.frozen
                    ? "border-dashed border-accent bg-transparent"
                    : "border-line bg-card2";
                return (
                  <li
                    key={day.date}
                    title={`${day.date}${day.count ? `, ${day.count} ${day.count === 1 ? "topic" : "topics"}` : day.frozen ? ", missed, and held" : ""}`}
                    className={`rounded-[2px] border ${fill} ${today ? "outline outline-1 outline-offset-1 outline-line-strong" : ""}`}
                    style={index === 0 ? { gridRow: layout.firstRow } : undefined}
                  />
                );
              })}
            </ol>
          </div>
        </div>
      </div>
      {anyFrozen && (
        <p className="mt-3 flex flex-wrap gap-x-4.5 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-[2px] bg-accent" /> a day you spoke
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-[2px] border border-dashed border-accent" /> a missed day the freeze
            held
          </span>
        </p>
      )}
    </>
  );
}

/* Recent runs, the genre glyph beside the time: the sentence says what,
   the glyph says what you have been practising. On a phone the genre
   drops and the time stays. */
function RecentList({ history, bank, now }: { history: History; bank: Bank; now: number }) {
  return (
    <ul className="max-w-[640px]">
      {history.recent.map((run, index) => {
        const genre = bank.genres.find((candidate) => candidate.slug === run.genre_slug);
        return (
          <li
            key={`${run.at}-${index}`}
            className="flex items-baseline justify-between gap-4 border-b border-line px-0.5 py-2.5 text-[15.5px] last:border-b-0"
          >
            <span>{run.topic_text}</span>
            <span className="inline-flex shrink-0 gap-3 text-[12.5px] font-semibold text-muted">
              {genre && (
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <GenreIcon icon={genre.icon} size={14} className="text-accent" />
                  {genre.name}
                </span>
              )}
              <time dateTime={run.at}>{timeAgo(run.at, now)}</time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
