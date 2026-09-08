import Link from "next/link";

import { Stats } from "@/components/round/phases";
import { Button } from "@/components/site/button";
import { FlameIcon, GenreIcon } from "@/components/site/icons";
import { Share } from "@/components/streak/share";
import type { SessionUser } from "@/lib/api";
import type { Bank } from "@/lib/bank";
import { ProgressSection } from "@/components/streak/progress";
import { type Day, type History, heatmapLayout, isRow, isStrip, timeAgo, weekdayName, windowLabel } from "@/lib/practice";
import { absolute } from "@/lib/site";

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
          <div className="mt-6 max-w-[760px]">
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
            <Calendar days={history.calendar} window={history.days} />
          </Section>

          <Section title="Recent" aside={<Capped history={history} pro={pro} />}>
            <RecentList history={history} bank={bank} now={now} />
          </Section>

          {/* Under the calendar, because the calendar answers "did I turn
              up" and this answers "am I getting better", which is the
              harder question and the one worth paying for. */}
          <div className="mt-9">
            <Section
              title="Progress"
              aside={
                <>
                  {history.progress.rounds.length > 0 && (
                    <>
                      {history.progress.counted} round{history.progress.counted === 1 ? "" : "s"} since{" "}
                      {new Date(history.progress.rounds[0].at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                      {pro ? "" : ". "}
                    </>
                  )}
                  {!pro && (
                    <>
                      Free draws {history.days} days. <PitchLink>Pro draws the year</PitchLink>
                    </>
                  )}
                </>
              }
            >
              <ProgressSection progress={history.progress} pro={pro} bank={bank} />
            </Section>
          </div>

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

          {/* Only once there is something to be proud of, and only with an
              account: a link to an empty calendar is not a thing anybody
              sends, and the link has to outlive the browser that made it. */}
          {user && <Share url={history.share_token ? absolute(`/s/${history.share_token}`) : null} />}

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

/* The window, drawn at whatever size it is.

   Everything on this page takes the whole width and follows the thing
   above it. The calendar and the list used to share a row on a laptop,
   on the premise that the calendar is the wide thing and the list is the
   tall one, so the two would finish together. They never did: a month is
   five columns of seven squares and stops growing, while the list grows
   by a row a round and runs to a thousand on Pro. The gap between them
   was the streak, so the better somebody practised the emptier their
   page looked (owner's call, from `mocks/streak-layout.html`). */
export function Calendar({ days, window }: { days: Day[]; window: number }) {
  if (isStrip(window)) return <Strip days={days} />;
  if (isRow(window)) return <Row days={days} />;
  return <Heatmap days={days} />;
}

export function Section({ title, aside, children }: { title: string; aside: React.ReactNode; children: React.ReactNode }) {
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

/* Cells size themselves to the room: a year across a laptop is a 13px
   square, eight weeks beside a list is a 34px one, and a phone gets what
   fits down to a floor, past which the row scrolls. Container query units
   do the arithmetic, so the weekday labels and the month names share the
   same cell without a script. */
const GAP = "4px";
const cellSize = (columns: number) => `clamp(9px, calc((100cqw - ${columns - 1} * ${GAP}) / ${columns}), 34px)`;

/* A week per column, time left to right, the last column the week you are
   in. The scroll container runs right to left with its content left to
   right, which is how it opens already scrolled to today on a phone with
   no script: the grid ends on today, so the end is the part worth showing.
   A dashed square is a day the freeze held: it did not happen, and a
   square that read as a run would be the calendar telling a small lie. */
export function Heatmap({ days }: { days: Day[] }) {
  const layout = heatmapLayout(days.map((day) => day.date));
  const anyFrozen = days.some((day) => day.frozen);
  return (
    <div style={{ "--cell": cellSize(layout.columns), "--gap": GAP } as React.CSSProperties}>
      <div className="flex items-start gap-2 [container-type:inline-size]">
        <div
          className="mt-[calc(14px+var(--gap))] grid text-[10px] font-semibold text-muted"
          style={{ gridTemplateRows: "repeat(7, var(--cell))", gap: "var(--gap)", lineHeight: "var(--cell)" }}
          aria-hidden
        >
          <span style={{ gridRow: 1 }}>Mon</span>
          <span style={{ gridRow: 3 }}>Wed</span>
          <span style={{ gridRow: 5 }}>Fri</span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto [direction:rtl] [scrollbar-width:thin]">
          {/* At least the container's width, so a grid that fits sits at the
              left like everything else on the page; only one that overflows
              is wider, and then the right-to-left container opens on today. */}
          <div className="w-max min-w-full [direction:ltr]">
            <div
              className="grid h-3.5 text-[10px] font-semibold whitespace-nowrap text-muted"
              style={{ gridAutoFlow: "column", gridAutoColumns: "var(--cell)", gap: "var(--gap)" }}
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
              style={{
                gridAutoFlow: "column",
                gridTemplateRows: "repeat(7, var(--cell))",
                gridAutoColumns: "var(--cell)",
                gap: "var(--gap)",
              }}
            >
              {days.map((day, index) => (
                <DaySquare
                  key={day.date}
                  day={day}
                  today={index === days.length - 1}
                  style={index === 0 ? { gridRow: layout.firstRow } : undefined}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
      {anyFrozen && <FrozenKey />}
    </div>
  );
}

/* A month as one line of days, left to right the way time runs.

   The same squares as the heatmap, in one row instead of seven. At the
   page's width thirty of them are twenty-six pixels each; the same month
   stacked into weeks is a 190 pixel block with seven hundred pixels of
   nothing beside it, which is what the two-column layout was leaving
   behind. A row also reads as time rather than as a grid whose columns
   are weeks nobody counts, so the three days somebody missed are a gap
   and not a hole. */
function Row({ days }: { days: Day[] }) {
  return (
    <div
      className="[container-type:inline-size]"
      style={{ "--cell": cellSize(days.length), "--gap": GAP } as React.CSSProperties}
    >
      <ol
        className="grid"
        style={{
          gridAutoFlow: "column",
          gridTemplateRows: "var(--cell)",
          gridAutoColumns: "var(--cell)",
          gap: "var(--gap)",
        }}
      >
        {days.map((day, index) => (
          <DaySquare key={day.date} day={day} today={index === days.length - 1} />
        ))}
      </ol>
      {/* Both ends named, because a row of squares with nothing written
          on it says how many days but never which. */}
      <div className="mt-2 flex justify-between text-[11.5px] text-muted">
        <span>{days.length > 0 ? longDate(days[0].date) : ""}</span>
        <span>Today</span>
      </div>
      {days.some((day) => day.frozen) && <FrozenKey />}
    </div>
  );
}

function longDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/* One day. A dashed square is a day the freeze held: it did not happen,
   and a square that read as a run would be the calendar telling a small
   lie. Shared by the row and the heatmap so the two cannot drift into
   meaning different things by the same colour. */
function DaySquare({ day, today, style }: { day: Day; today: boolean; style?: React.CSSProperties }) {
  const fill = day.count
    ? "border-accent bg-accent"
    : day.frozen
      ? "border-dashed border-accent bg-transparent"
      : "border-line bg-card2";
  return (
    <li
      title={`${day.date}${day.count ? `, ${day.count} ${day.count === 1 ? "topic" : "topics"}` : day.frozen ? ", missed, and held" : ""}`}
      className={`rounded-[3px] border ${fill} ${today ? "outline outline-1 outline-offset-1 outline-line-strong" : ""}`}
      style={style}
    />
  );
}

function FrozenKey() {
  return (
    <p className="mt-3 flex flex-wrap gap-x-4.5 gap-y-1 text-[13px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block size-3 rounded-[2px] bg-accent" /> a day you spoke
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block size-3 rounded-[2px] border border-dashed border-accent" /> a missed day the freeze held
      </span>
    </p>
  );
}

/* Recent runs, the genre glyph beside the time: the sentence says what,
   the glyph says what you have been practising. On a phone the genre
   drops and the time stays. */
function RecentList({ history, bank, now }: { history: History; bank: Bank; now: number }) {
  return (
    /* Two columns now that the list has the page's width, which halves
       the height of a long one and is the other half of why this page
       used to grow a hole down its left. Every row keeps its rule, so
       both columns end on a line rather than one of them stopping in
       mid-air. */
    <ul className="sm:columns-2 sm:gap-x-12">
      {history.recent.map((run, index) => {
        const genre = bank.genres.find((candidate) => candidate.slug === run.genre_slug);
        return (
          <li
            key={`${run.at}-${index}`}
            className="flex break-inside-avoid items-baseline justify-between gap-4 border-b border-line px-0.5 py-2.5 text-[15.5px]"
          >
            {/* A link only where there is something to open. A round
                practised before the report existed, or with no microphone,
                has none, and a link to a 404 is worse than plain text. */}
            {run.has_report ? (
              <a href={`/streak/${run.id}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                {run.topic_text}
              </a>
            ) : (
              <span>{run.topic_text}</span>
            )}
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
