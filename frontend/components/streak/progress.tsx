"use client";

import Link from "next/link";
import { Area, AreaChart, ReferenceArea, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import {
  DOTS_UNTIL,
  FIRSTS,
  LINES,
  SIX,
  byGenre,
  byPrep,
  floor,
  inside,
  thenAndNow,
  workOn,
  type Compared,
  type Skill,
} from "@/lib/progress";
import { clock, minuteBlocks, movement, waveform, type Point, type Progress } from "@/lib/report";
import type { Bank } from "@/lib/bank";

/* Whether somebody is getting better, drawn for the person practising.

   They want three things: proof they got better at what scared them, one
   thing to work on next, and to know a bad day is not a relapse. So the
   page compares the first rounds with the last in plain sentences, names
   the skill furthest from comfortable with the round that shows it, and
   puts the worst recent round against the first week's average. Under
   that, three lines over the window, the genres, the firsts, and the
   first minute above the latest as waves.

   Recharts here and nowhere but /streak. The lines are a real chart;
   everything else is dots on a track, a table and sentences, drawn by
   hand because a track and a marker is not a chart.

   Free keeps the lines and the waves, which its five-day window can
   fill. Then-and-now, the floor, the genres and the firsts need history
   to mean anything, and history is what the plan sells, so free sees one
   sentence saying what Pro would show, as the calendar already does. */

export function ProgressSection({ progress, pro, bank }: { progress: Progress; pro: boolean; bank: Bank }) {
  if (!progress.enough) {
    // One round is a report, not a trend. Two is a before and an after,
    // which is the whole page, so this is the shortest wait there is.
    return <p className="text-sm text-muted">Do one more round and you can see the two side by side.</p>;
  }
  const rounds = progress.rounds;
  return (
    <div>
      <Sub>Then and now</Sub>
      <ThenAndNow progress={progress} pro={pro} />

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <WorkOnNext progress={progress} />
        <Floor progress={progress} pro={pro} />
      </div>

      <Sub aside={pro ? "over the last year" : `over the last ${rounds.length} round${rounds.length === 1 ? "" : "s"}`}>
        The three that matter
      </Sub>
      <div className="grid gap-3.5 sm:grid-cols-3">
        {LINES.map((line) => (
          <Trend key={line.key} line={line} points={progress.points} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-x-8">
        <Genres progress={progress} pro={pro} bank={bank} />
        <Firsts progress={progress} pro={pro} />
      </div>

      <SideBySide progress={progress} />
    </div>
  );
}

function Sub({ children, aside }: { children: React.ReactNode; aside?: string }) {
  return (
    <p className="mt-6 mb-2.5 text-[12.5px] font-semibold first:mt-0">
      {children}
      {aside && <span className="font-normal text-muted"> · {aside}</span>}
    </p>
  );
}

function Pitch({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/pro" className="font-semibold text-accent-strong underline underline-offset-3 dark:text-accent">
      {children}
    </Link>
  );
}

/* Dates are formatted the same way on the server and in the browser, or
   the page fails to hydrate: Node and a phone disagree on the default
   locale and the default zone, and "September 7" against "7 September"
   is a mismatch React refuses. One locale and one zone, by hand. */
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const short = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/* ---------------------------------------------------------- then and now */

function ThenAndNow({ progress, pro }: { progress: Progress; pro: boolean }) {
  const rounds = progress.rounds;
  if (rounds.length < SIX) {
    const more = SIX - rounds.length;
    return (
      <p className="text-[13px] text-muted">
        Do {more} more round{more === 1 ? "" : "s"} and this compares your first three with your last three.
      </p>
    );
  }
  if (!pro) {
    return (
      <p className="text-[13px] text-muted">
        Your first rounds against your last, one sentence per skill. <Pitch>Pro keeps the rounds this needs</Pitch>.
      </p>
    );
  }
  const shown = thenAndNow(rounds);
  if (!shown) return null;
  return (
    <div>
      <p className="-mt-1.5 mb-2 text-[12px] text-muted">
        Your first {shown.k} rounds against your last {shown.k}.
      </p>
      <div className="rounded-card border border-line bg-card px-4 py-1">
        {shown.rows.map((row) => (
          <Row key={row.skill.key} row={row} word={shown.word} />
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-3.5 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full border-2 border-line-strong bg-surface" />
          then
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-accent" />
          now
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2 w-3 rounded-[3px] bg-accent/25" />
          comfortable
        </span>
      </div>
    </div>
  );
}

const pct = (v: number, [lo, hi]: [number, number]) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

/* One skill: its name, one sentence, and where you were against where you
   are, as two dots on the comfortable stretch. */
function Row({ row, word }: { row: Compared; word: string | null }) {
  const { skill } = row;
  const scale: [number, number] = skill.rate ? [0, row.of] : (skill.scale ?? [0, 1]);
  const label = skill.key === "habit" && word ? `Your word: ${word}` : skill.label;
  const ends: [string, string] = skill.rate ? ["0", `${row.of} of ${row.of}`] : [skill.fmt(scale[0]), skill.fmt(scale[1])];
  const lo = Math.min(row.then, row.now);
  const hi = Math.max(row.then, row.now);
  return (
    <div className="grid items-center gap-x-5 gap-y-1.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[8.5rem_minmax(0,1fr)_200px]">
      <span className="text-[12.5px] font-semibold">{label}</span>
      <span className="text-[13px] text-muted">{row.sentence}</span>
      <div className="relative h-[22px]" aria-hidden>
        <span className="absolute top-[10px] right-0 left-0 h-0.5 bg-line" />
        {skill.good && skill.scale && (
          <span
            className="absolute top-2 h-1.5 rounded-full bg-accent/25"
            style={{ left: `${pct(skill.good[0], scale)}%`, width: `${pct(skill.good[1], scale) - pct(skill.good[0], scale)}%` }}
          />
        )}
        <span
          className="absolute top-[10px] h-0.5 bg-line-strong"
          style={{ left: `${pct(lo, scale)}%`, width: `${pct(hi, scale) - pct(lo, scale)}%` }}
        />
        <span
          title={`then ${skill.rate ? row.then : skill.fmt(row.then)}`}
          className="absolute top-1.5 size-2.5 -translate-x-1/2 rounded-full border-2 border-line-strong bg-surface"
          style={{ left: `${pct(row.then, scale)}%` }}
        />
        <span
          title={`now ${skill.rate ? row.now : skill.fmt(row.now)}`}
          className={`absolute top-[5px] size-3 -translate-x-1/2 rounded-full border-2 border-surface ring-1 ${
            row.inside ? "bg-accent ring-accent" : "bg-warn ring-warn"
          }`}
          style={{ left: `${pct(row.now, scale)}%` }}
        />
        <span className="absolute -top-1.5 left-0 text-[10px] text-muted">{ends[0]}</span>
        <span className="absolute -top-1.5 right-0 text-[10px] text-muted">{ends[1]}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- work on, floor */

function Card({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-card px-4 py-3.5">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{label}</p>
      <h3 className="font-display mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
      {children}
    </div>
  );
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/* The skill furthest from comfortable, named, with the round that shows
   it and one thing to do. A coach does this and a dashboard never does;
   next week it is either fixed or still the one. */
function WorkOnNext({ progress }: { progress: Progress }) {
  const pick = workOn(progress.rounds);
  if (!pick) return null;
  if (pick.none) {
    return (
      <Card label="Work on next" title="Nothing is out of range.">
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Every skill sat in the comfortable stretch over your last {pick.looked} rounds. Try a harder genre, or no
          time to think.
        </p>
      </Card>
    );
  }
  const { skill, worst, word } = pick;
  const name = skill.key === "habit" && word ? `the word "${word}"` : (skill.name ?? skill.label.toLowerCase());
  const worstValue = skill.key === "habit" && word ? worst.leaned[word] ?? 0 : valueOf(worst, skill);
  return (
    <Card label="Work on next" title={capital(name)}>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {skill.label === "Your word" ? `"${word}"` : skill.label} was outside the comfortable range in{" "}
        <b className="font-semibold text-ink">
          {pick.out} of your last {pick.looked}
        </b>{" "}
        rounds, {skill.fmt(pick.mean)} on average. Worst on{" "}
        <Link href={`/streak/${worst.id}`} className="font-semibold text-accent-strong underline underline-offset-3">
          {when(worst.at)}
        </Link>
        , {skill.fmt(worstValue)}.
      </p>
      {skill.advice && <p className="mt-2 text-[13px] leading-relaxed text-muted">{skill.advice}</p>}
    </Card>
  );
}

function valueOf(round: Progress["rounds"][number], skill: Skill): number {
  switch (skill.key) {
    case "silence":
      return round.silence;
    case "stall":
      return round.stall;
    case "restarts":
      return round.restarts;
    case "spoken":
      return round.setting > 0 ? (round.spoken / round.setting) * 60 : 0;
    default:
      return 0;
  }
}

/* Your quietest recent round against your first rounds' average. Getting
   better is mostly the bad days getting less bad, and this is true weeks
   before any average moves. */
function Floor({ progress, pro }: { progress: Progress; pro: boolean }) {
  const shown = pro ? floor(progress.rounds) : null;
  if (!shown) {
    return (
      <Card label="Your floor" title="Not yet.">
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {pro ? (
            <>After six rounds this compares your quietest recent round with your first rounds' average, because getting better mostly means the bad days getting less bad.</>
          ) : (
            <>
              Your quietest recent round against your first week's average, because getting better mostly means the bad
              days getting less bad. <Pitch>Pro keeps the rounds this needs</Pitch>.
            </>
          )}
        </p>
      </Card>
    );
  }
  const top = Math.max(shown.worstNow, shown.avgThen, 1) * 1.15;
  return (
    <Card label="Your floor" title={shown.beats ? "Your bad days beat your old average." : "Your floor has not moved yet."}>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Your quietest round of your last {shown.k} had{" "}
        <b className="font-semibold text-ink">{Math.round(shown.worstNow)} seconds</b> of silence. Your first{" "}
        {shown.k} averaged {Math.round(shown.avgThen)}.{" "}
        {shown.beats ? "A bad day now is better than an ordinary day was." : "Keep going. This moves before the average does."}
      </p>
      <div className="mt-3 flex h-[54px] items-end gap-2.5">
        <div className="flex flex-1 flex-col justify-end gap-1 text-[11px] text-muted">
          <i className="block rounded-t-[4px] bg-line-strong" style={{ height: `${(shown.avgThen / top) * 40}px` }} />
          first {shown.k}, average {Math.round(shown.avgThen)}s
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1 text-[11px] text-muted">
          <i className="block rounded-t-[4px] bg-accent" style={{ height: `${(shown.worstNow / top) * 40}px` }} />
          last {shown.k}, worst {Math.round(shown.worstNow)}s
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ the lines */

type Line = (typeof LINES)[number];
/* What Recharts hands a custom dot. The value it passes for an area is a
   pair (the base and the top), so the row's own fields are read off the
   payload instead. */
type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number | [number, number];
  payload?: { index: number; value: number; at: string };
};

const fmt = (value: number, unit: string) => `${Math.round(value * 10) / 10}${unit}`;

/* One skill over the window, against the comfortable stretch shaded, with
   a dot per round while there are few: three rounds are three dots, and a
   smooth curve through three points draws a shape nobody made. Said as
   "was 27s · better" rather than up or down, since lower is better here
   and up and down say nothing about that. */
function Trend({ line, points }: { line: Line; points: Point[] }) {
  const moved = movement(points, (p) => p[line.key]);
  const data = points.map((point, index) => ({ index, value: point[line.key], at: point.at }));
  const top = Math.max(line.floor, ...data.map((row) => row.value)) * 1.05;
  const dots = points.length <= DOTS_UNTIL;
  const last = data.length - 1;
  const dot = (props: DotProps) => {
    const { cx = 0, cy = 0, payload } = props;
    const index = payload?.index ?? props.index ?? 0;
    const value = payload?.value ?? (Array.isArray(props.value) ? props.value[1] : props.value) ?? 0;
    if (!dots && index !== last) return <g key={index} />;
    return (
      <g key={index}>
        <circle cx={cx} cy={cy} r={dots ? 4 : 3.5} fill={value > line.good ? "var(--warn)" : "var(--accent)"} stroke="var(--surface)" strokeWidth={2} />
        {index === last && (
          <text x={cx + 7} y={cy + 4} fontSize={10.5} fontWeight={600} fill="var(--ink)">
            {fmt(value, line.unit)}
          </text>
        )}
      </g>
    );
  };
  const word = !moved ? null : moved.to < moved.from ? "better" : moved.to > moved.from ? "worse" : "steady";
  return (
    <div className="rounded-card border border-line bg-card px-4 pt-3.5 pb-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{line.label}</span>
        {moved && <span className="text-[15px] font-semibold tabular-nums">{fmt(moved.to, line.unit)}</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap justify-between gap-x-2 text-[11.5px] text-muted">
        {moved ? (
          <span>
            was {fmt(moved.from, line.unit)} ·{" "}
            <span className={word === "better" ? "font-semibold text-accent-strong" : word === "worse" ? "font-semibold text-ink" : "font-semibold"}>
              {word}
            </span>
          </span>
        ) : (
          <span>Not counted yet</span>
        )}
        <span>comfortable under {fmt(line.good, line.unit)}</span>
      </div>
      <div className="mt-2 h-[64px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 28, bottom: 2, left: 2 }}>
            <YAxis hide domain={[0, top]} />
            <ReferenceArea y1={0} y2={line.good} fill="var(--accent)" fillOpacity={0.12} stroke="none" />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line-strong)", borderRadius: 10, fontSize: 12 }}
              labelFormatter={() => ""}
              formatter={(value, _name, item) => [fmt(Number(value), line.unit), when((item.payload as { at: string }).at)]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.1}
              dot={dot}
              activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- genres and firsts */

function Genres({ progress, pro, bank }: { progress: Progress; pro: boolean; bank: Bank }) {
  const name = (slug: string) => bank.genres.find((genre) => genre.slug === slug)?.name ?? slug;
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-semibold">By genre</p>
      {!pro ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Where you are weak and where you are fine, genre by genre. <Pitch>Pro keeps the rounds this needs</Pitch>.
        </p>
      ) : (
        <GenreTable progress={progress} name={name} />
      )}
    </div>
  );
}

function GenreTable({ progress, name }: { progress: Progress; name: (slug: string) => string }) {
  const rows = byGenre(progress.rounds);
  const prep = byPrep(progress.rounds);
  if (!rows) {
    return <p className="text-[13px] leading-relaxed text-muted">Practise a second genre and this says which one is harder for you.</p>;
  }
  return (
    <>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            <th className="border-b border-line pb-1.5 font-semibold">Genre</th>
            <th className="border-b border-line pb-1.5 text-right font-semibold">Rounds</th>
            <th className="border-b border-line pb-1.5 text-right font-semibold">Silence</th>
            <th className="border-b border-line pb-1.5 text-right font-semibold">Start</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.slug} className={index === 0 ? "text-ink" : "text-muted"}>
              <td className="border-b border-line py-1.5 font-semibold text-ink">
                {name(row.slug)}
                {index === 0 && <span className="font-normal text-muted"> · hardest</span>}
              </td>
              <td className="border-b border-line py-1.5 text-right tabular-nums">{row.rounds}</td>
              <td className="border-b border-line py-1.5 text-right tabular-nums">{Math.round(row.silence)}s</td>
              <td className="border-b border-line py-1.5 text-right tabular-nums">{Math.round(row.stall * 10) / 10}s</td>
            </tr>
          ))}
        </tbody>
      </table>
      {prep && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
          With no time to think you start after{" "}
          <b className="font-semibold text-ink">{Math.round(prep.none * 10) / 10}s</b>; with time to think,{" "}
          {Math.round(prep.some * 10) / 10}s.
        </p>
      )}
    </>
  );
}

function Firsts({ progress, pro }: { progress: Progress; pro: boolean }) {
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-semibold">Firsts</p>
      {!pro ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Your first minute with no holes, your first round with no restarts, your first clean ending, each a link to
          the round. <Pitch>Pro keeps them</Pitch>.
        </p>
      ) : (
        <ul className="m-0 list-none p-0 text-[12.5px]">
          {FIRSTS.map(([key, label]) => {
            const first = progress.firsts[key];
            return (
              <li key={key} className="flex justify-between gap-2.5 border-b border-line py-1.5 last:border-b-0">
                <span className={first ? "inline-flex items-center gap-1.5 font-semibold" : "inline-flex items-center gap-1.5 text-muted"}>
                  {first ? (
                    <svg viewBox="0 0 24 24" className="size-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-3.5 text-line-strong" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                  {first ? (
                    <Link href={`/streak/${first.run_id}`} className="underline underline-offset-3">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </span>
                <span className="shrink-0 text-muted tabular-nums">{first ? when(first.at) : "not yet"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------- the two minutes */

/* The first minute above the latest, at the same scale, as the wave the
   round page draws. The most convincing thing this product can show, and
   it costs nothing beyond what is already stored: a wave full of holes
   becoming one that is mostly voice, with no number to argue with. */
function SideBySide({ progress }: { progress: Progress }) {
  const { first, latest } = progress;
  if (!first || !latest || first.at === latest.at) return null;
  const scale = Math.max(first.seconds, latest.seconds);
  return (
    <div className="mt-6">
      <p className="text-[12.5px] font-semibold">Your first minute, and your latest</p>
      <div className="mt-2 space-y-1.5">
        <Wave label="First" minute={first} scale={scale} />
        <Wave label="Latest" minute={latest} scale={scale} />
      </div>
    </div>
  );
}

const TONE = { breath: { stroke: "var(--line-strong)", width: 1.5 }, gap: { stroke: "var(--warn)", width: 3 } };

function Wave({ label, minute, scale }: { label: string; minute: { at: string; seconds: number; segments: number[][] }; scale: number }) {
  const marks = waveform(minuteBlocks(minute.segments, scale));
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[5.5rem_1fr]">
      <span className="text-[11.5px] leading-tight text-muted">
        <b className="block text-[12px] font-semibold text-ink">{label}</b>
        {short(minute.at)}
      </span>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="block h-9 w-full overflow-visible" role="img" aria-label={`${label} minute`}>
        {marks.map((mark, index) =>
          mark.kind === "stroke" ? (
            <line key={index} x1={mark.x} x2={mark.x} y1={18 - mark.height * 16} y2={18 + mark.height * 16} stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ) : (
            <line key={index} x1={mark.from} x2={mark.to} y1={18} y2={18} stroke={TONE[mark.tone].stroke} strokeWidth={TONE[mark.tone].width} vectorEffect="non-scaling-stroke" />
          ),
        )}
      </svg>
    </div>
  );
}

export { clock };
