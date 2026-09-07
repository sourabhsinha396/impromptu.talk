"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Bands, Headline, MinuteBar, Transcript } from "@/components/round/report";
import {
  RUN_ON,
  axes,
  clock,
  distinctWords,
  fit,
  lastWord,
  paceCaption,
  saidCount,
  sentenceCaption,
  shapeCaption,
  slices,
  type Band,
  type Report,
  type Slice,
  type Usual,
} from "@/lib/report";

/* One round, read all the way back.

   The done screen is a moment and stays one bar and one sentence; this is
   the record, reached on purpose from the streak page, and it has room.
   Everything on it is arithmetic over what a round already stores, the
   word timings above all: where each um fell, how the pace moved through
   the minute, what was said twice, where a sentence was begun again, how
   long each sentence ran. Nothing here is written by a model and nothing
   here is a score with a name.

   Recharts, which /streak already loads and nothing else does: the pace
   line, the shape of the round and the donut are axes, polygons and arcs
   with hover, which is the work a library is for. The bar, the bands, the
   sentence columns and the tiles stay hand-drawn, as on the done screen,
   because a track and a marker is not a chart. */

export function RoundDetail({ report, length }: { report: Report; length: number }) {
  if (!report.heard) {
    return <p className="text-sm text-muted">We could not hear you. Check your microphone.</p>;
  }
  const rows = axes(report);
  const bars = rows.filter((row) => !row.radarOnly);
  const timed = report.pace_curve.length > 1;

  return (
    <div className="w-full">
      <MinuteBar report={report} length={length} ticks={report.filler_times} />
      <BarKey fillers={report.filler_times.length > 0} />
      <Headline report={report} />

      {timed && (
        <Section
          title="Pace through the minute"
          aside={report.pace !== null ? `${report.pace} wpm over the round` : undefined}
        >
          <PaceChart report={report} length={length} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{paceCaption(report)}</p>
        </Section>
      )}

      <Section title="The shape of your round" aside={shapeCaption(rows)}>
        <div className="grid gap-5 sm:grid-cols-[250px_1fr] sm:items-center sm:gap-x-8">
          <Shape rows={rows} usual={report.usual} />
          <Bands rows={bars} columns={1} />
        </div>
      </Section>

      {report.words !== null && (
        <Section title="Words you leaned on" aside={leanAside(report)}>
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-8">
            <LeanedOn report={report} />
            <Repeats report={report} />
          </div>
        </Section>
      )}

      {report.sentences.length > 0 && (
        <Section title="Sentences" aside={sentenceAside(report)}>
          <Sentences report={report} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{sentenceCaption(report)}</p>
        </Section>
      )}

      <Tiles report={report} length={length} />

      <Section title="Read it back">
        <Transcript report={report} open />
      </Section>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
        {aside && <span className="text-[12.5px] tabular-nums text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/* What the wave means, said once under it: the wiggle is a voice, the
   flat line is nobody speaking, the warm line is a hole you would notice. */
function BarKey({ fillers }: { fillers: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-flex h-3 items-center gap-px" aria-hidden>
          <i className="block h-2 w-0.5 rounded-full bg-accent" />
          <i className="block h-3 w-0.5 rounded-full bg-accent" />
          <i className="block h-2.5 w-0.5 rounded-full bg-accent" />
        </i>
        talking
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block w-3.5 border-t-[1.5px] border-line-strong" />a breath
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block w-3.5 border-t-[3px] border-warn" />a gap you would notice
      </span>
      {fillers && (
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2 rounded-full bg-warn" />
          an um
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the pace */

type PaceDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { at: number; wpm: number };
};

/* Words a minute in each ten seconds against the comfortable stretch.

   One number for the round hides its shape. Run 30 read as a single 235
   and was 156, 120, 210, 78, 126, 75 across its six stretches: a sprint
   at 0:20 and a fade from 0:40. Only the peak and the trough are
   labelled; the axis and the hover carry the rest. */
function PaceChart({ report, length }: { report: Report; length: number }) {
  const data = report.pace_curve.map((point) => ({
    at: (point.start + point.end) / 2,
    wpm: point.wpm,
    start: point.start,
    end: point.end,
  }));
  const top = Math.max(240, ...data.map((point) => point.wpm));
  const fast = data.reduce((best, point) => (point.wpm > best.wpm ? point : best));
  const slow = data.reduce((best, point) => (point.wpm < best.wpm ? point : best));
  const ticks: number[] = [];
  for (let tick = 0; tick <= length; tick += 10) ticks.push(tick);

  const dot = (props: PaceDotProps) => {
    const { cx = 0, cy = 0, index = 0, payload } = props;
    const wpm = payload?.wpm ?? 0;
    const outside = wpm < 130 || wpm > 170;
    const labelled = payload !== undefined && (payload.at === fast.at || payload.at === slow.at);
    return (
      <g key={index}>
        <circle cx={cx} cy={cy} r={4.5} fill={outside ? "var(--warn)" : "var(--accent)"} stroke="var(--surface)" strokeWidth={2} />
        {labelled && (
          <text
            x={cx}
            y={cy + (payload.at === fast.at ? -10 : 18)}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--ink)"
          >
            {wpm}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke="var(--line)" />
          <ReferenceArea
            y1={130}
            y2={170}
            fill="var(--accent)"
            fillOpacity={0.12}
            stroke="none"
            label={{
              value: "comfortable, 130 to 170",
              position: "insideTopRight",
              fontSize: 11,
              fontWeight: 600,
              fill: "var(--accent-strong)",
            }}
          />
          <XAxis
            dataKey="at"
            type="number"
            domain={[0, length]}
            ticks={ticks}
            tickFormatter={(value) => clock(Number(value))}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, top]}
            ticks={[0, 80, 160, 240]}
            width={30}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={() => ""}
            formatter={(value, _name, item) => {
              const row = item.payload as { start: number; end: number };
              return [`${value} wpm`, `${clock(row.start)} to ${clock(row.end)}`];
            }}
          />
          <Area
            type="monotone"
            dataKey="wpm"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="var(--accent)"
            fillOpacity={0.1}
            isAnimationActive={false}
            dot={dot}
            activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------ the shape */

type ShapeDotProps = { cx?: number; cy?: number; index?: number; value?: number };

/* The radar. The dashed pentagon is the comfortable range, the filled
   shape is today, the thin outline is your usual over your last rounds.
   A radar with no reference shape is a blob, which is why the target is
   drawn; and there is no average beside it, because an average of seconds
   and words a minute is a number with nothing behind it. */
function Shape({ rows, usual }: { rows: Band[]; usual: Usual | null }) {
  const data = rows.map((row) => ({
    axis: row.short ?? row.label,
    today: fit(row) ?? 0,
    usual: row.usual !== null && row.usual !== undefined ? (fit(row, row.usual) ?? undefined) : undefined,
    target: 100,
  }));
  const showUsual = usual !== null && data.every((point) => point.usual !== undefined);
  const dot = (props: ShapeDotProps) => {
    const { cx = 0, cy = 0, index = 0, value = 0 } = props;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={4}
        fill={value < 100 ? "var(--warn)" : "var(--accent)"}
        stroke="var(--surface)"
        strokeWidth={2}
      />
    );
  };
  return (
    <div className="mx-auto w-[250px]">
      <RadarChart width={250} height={250} data={data} outerRadius={84} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
        <PolarGrid gridType="polygon" stroke="var(--line)" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted)" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="target" stroke="var(--line-strong)" strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
        {showUsual && (
          <Radar dataKey="usual" stroke="var(--muted)" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
        )}
        <Radar
          dataKey="today"
          stroke="var(--accent)"
          strokeWidth={2}
          fill="var(--accent)"
          fillOpacity={0.22}
          isAnimationActive={false}
          dot={dot}
        />
      </RadarChart>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-[11.5px] text-muted">
        <Key stroke="border-t-2 border-accent" label="today" />
        <Key stroke="border-t border-dashed border-line-strong" label="comfortable" />
        {showUsual && usual && <Key stroke="border-t-[1.5px] border-muted" label={`your usual, ${usual.rounds} rounds`} />}
      </div>
    </div>
  );
}

function Key({ stroke, label }: { stroke: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`inline-block w-3.5 ${stroke}`} />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------- leaned on */

function leanAside(report: Report): string {
  const parts = slices(report);
  const total = parts.reduce((sum, slice) => sum + slice.count, 0);
  const out = [`${total} of ${saidCount(report)} words`];
  const fillers = report.filler_counts.reduce((sum, filler) => sum + filler.count, 0);
  if (report.fillers_at_transitions !== null && fillers > 0) {
    out.push(`${report.fillers_at_transitions} um${report.fillers_at_transitions === 1 ? "" : "s"} beside a gap`);
  }
  return out.join(" · ");
}

function paint(slice: Slice): string {
  return slice.kind === "filler" ? "var(--warn)" : "var(--accent)";
}

/* The donut with a total in the middle. The ring is every word you said,
   the warm slices are fillers, the accent slices the words you lean on,
   and the quiet remainder is the rest of your minute. Hover a slice and
   the centre answers with that word. It replaces the "ums a minute" band:
   a cluster you can see needs no rate beside it (owner's call). */
function LeanedOn({ report }: { report: Report }) {
  const parts = slices(report);
  const total = parts.reduce((sum, slice) => sum + slice.count, 0);
  const all = saidCount(report);
  const [active, setActive] = useState<Slice | null>(null);
  const data = [
    ...parts.map((slice) => ({ name: slice.word, value: slice.count, slice })),
    { name: "rest", value: Math.max(0, all - total), slice: null },
  ];
  const fillers = parts.filter((slice) => slice.kind === "filler");
  const crutches = parts.filter((slice) => slice.kind === "crutch");

  return (
    <div>
      <div className="grid grid-cols-[150px_1fr] items-center gap-4">
        <div className="relative size-[150px]">
          <PieChart width={150} height={150}>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={66}
              startAngle={90}
              endAngle={-270}
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActive(data[index]?.slice ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((row, index) => (
                <Cell
                  key={index}
                  fill={row.slice ? paint(row.slice) : "var(--line)"}
                  fillOpacity={row.slice ? row.slice.shade : 1}
                />
              ))}
            </Pie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[26px] leading-none font-semibold tracking-[-0.02em]">{active ? active.count : total}</span>
            <span className="mt-1 text-[11px] font-semibold text-muted">{active ? active.word : `of ${all} words`}</span>
          </div>
        </div>
        <ul className="m-0 list-none p-0 text-[12.5px]">
          {report.filler_counts.length > 0 || report.fillers !== null ? (
            <>
              <Group>Fillers</Group>
              {fillers.length ? fillers.map((slice) => <Row key={slice.word} slice={slice} />) : <Plain>Not one um.</Plain>}
            </>
          ) : null}
          <Group>Words you lean on</Group>
          {crutches.length ? crutches.map((slice) => <Row key={slice.word} slice={slice} />) : <Plain>None this time.</Plain>}
        </ul>
      </div>
      {report.fillers === null && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The free transcriber drops the ums before anybody can count them.{" "}
          <a href="/pro" className="font-semibold text-accent-strong underline underline-offset-4">
            Pro counts them
          </a>
          .
        </p>
      )}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <li className="pt-1.5 pb-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase first:pt-0">{children}</li>
  );
}

function Plain({ children }: { children: React.ReactNode }) {
  return <li className="py-1 text-muted">{children}</li>;
}

function Row({ slice }: { slice: Slice }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <i className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: paint(slice), opacity: slice.shade }} />
      <span className="flex-1 font-semibold">{slice.word}</span>
      <span className="tabular-nums text-muted">{slice.count}</span>
    </li>
  );
}

/* Phrases that came back, and sentences begun twice. A restart is the
   two-word run underlined where it happened, both times. */
function Repeats({ report }: { report: Report }) {
  if (!report.repeats.length && !report.restarts.length) {
    return <p className="text-[12.5px] text-muted">Nothing said twice, no restarts.</p>;
  }
  return (
    <div>
      {report.repeats.length > 0 && (
        <>
          <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Said more than once</p>
          <ul className="m-0 list-none p-0 text-[13px]">
            {report.repeats.slice(0, 4).map((repeat) => (
              <li key={repeat.phrase} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
                <span className="font-semibold">
                  <span className="text-muted">“</span>
                  {repeat.phrase}
                  <span className="text-muted">”</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{repeat.count} times</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.restarts.length > 0 && (
        <>
          <p className={`mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase ${report.repeats.length ? "mt-4" : ""}`}>
            Restart{report.restarts.length === 1 ? "" : "s"}
          </p>
          <ul className="m-0 list-none p-0 text-[13px]">
            {report.restarts.slice(0, 3).map((restart) => (
              <li key={restart.at} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
                <span>
                  <span className="text-muted">“</span>
                  <Quoted quote={restart.quote} />
                  <span className="text-muted">”</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{clock(restart.at)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            A restart is a sentence begun twice within a few seconds: the sound of losing the thread and going back
            for it.
          </p>
        </>
      )}
    </div>
  );
}

/* The two words that were begun on twice, underlined both times. */
function Quoted({ quote }: { quote: string }) {
  const words = quote.split(" ");
  const bare = (word: string) => word.replace(/[^A-Za-z']/g, "").toLowerCase();
  const pair = `${bare(words[0])} ${bare(words[1] ?? "")}`;
  const out: React.ReactNode[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const here = `${bare(words[index])} ${bare(words[index + 1] ?? "")}`;
    if (here === pair && index + 1 < words.length) {
      out.push(
        <u key={index} className="font-semibold text-ink decoration-warn decoration-dotted decoration-2 underline-offset-[3px]">
          {words[index]} {words[index + 1]}
        </u>,
      );
      out.push(" ");
      index += 1;
    } else {
      out.push(`${words[index]} `);
    }
  }
  return <>{out}</>;
}

/* ---------------------------------------------------------- sentences */

function sentenceAside(report: Report): string {
  const counts = report.sentences.map((sentence) => sentence.words);
  const mean = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length);
  return `${counts.length} sentence${counts.length === 1 ? "" : "s"} · ${mean} words each`;
}

/* Past this many sentences the words beside each bar go, and the bars
   thin out, so a ten-minute round is a strip and not a wall. */
const SENTENCES_WITH_WORDS = 12;

/* One bar per sentence, first to last, its length the word count, the
   run-on in warm, and the sentence's own words beside it so the bar says
   which one it was. Bars run across rather than up (owner's call): six
   columns left most of the width empty, and a sentence is text, which
   reads along a line. The hairline is the run-on edge. */
function Sentences({ report }: { report: Report }) {
  const counts = report.sentences.map((sentence) => sentence.words);
  const top = Math.max(...counts, RUN_ON + 10);
  const compact = report.sentences.length > SENTENCES_WITH_WORDS;
  const edge = `${(RUN_ON / top) * 100}%`;
  return (
    <>
      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        {report.sentences.map((sentence, index) => (
          <div
            key={index}
            title={`${sentence.words} words: ${sentence.text}`}
            className={`grid items-center gap-x-3 ${
              compact ? "grid-cols-[minmax(0,1fr)_2rem]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem]"
            }`}
          >
            {!compact && <span className="truncate text-[12px] text-muted">{sentence.text}</span>}
            <div className={`relative ${compact ? "h-1.5" : "h-2.5"}`}>
              <span className="absolute inset-y-[-3px] w-px bg-line-strong" style={{ left: edge }} aria-hidden />
              <span
                className={`absolute inset-y-0 left-0 rounded-r-[4px] ${sentence.words > RUN_ON ? "bg-warn" : "bg-accent"}`}
                style={{ width: `${(sentence.words / top) * 100}%` }}
              />
            </div>
            <span className="text-right text-[11.5px] tabular-nums text-muted">{sentence.words}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>first to last</span>
        <span>the line is {RUN_ON} words</span>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- tiles */

/* The facts that are not a scale. Three columns and never two and one. */
function Tiles({ report, length }: { report: Report; length: number }) {
  const tiles: [string, string][] = [
    [clock(report.opening_stall), "to your first word"],
    [clock(lastWord(report, length)), report.ended_clean ? "last word, on a full stop" : "last word, mid-sentence"],
  ];
  if (report.words !== null) tiles.push([String(distinctWords(report)), `different words of ${report.words}`]);
  return (
    <div className={`mt-9 grid gap-2.5 ${tiles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {tiles.map(([number, label]) => (
        <div key={label} className="min-w-0 rounded-card border border-line bg-card px-3 py-3.5">
          <div className="text-[22px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[26px]">{number}</div>
          <div className="mt-1 text-[12px] leading-snug text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
