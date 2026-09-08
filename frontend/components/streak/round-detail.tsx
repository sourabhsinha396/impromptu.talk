"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Bands, Headline, MinuteBar, Transcript } from "@/components/round/report";
import { Sample, SampleRead, CaseRead } from "@/components/streak/case";
import { WordCloud } from "@/components/streak/cloud";
import { SAMPLE_LENGTH, SAMPLE_REPORT } from "@/lib/case";
import { tally } from "@/lib/words";
import {
  RUN_ON,
  at,
  axes,
  clock,
  dialNumber,
  distinctWords,
  lastWord,
  paceCaption,
  saidCount,
  sentenceCaption,
  shapeCaption,
  slices,
  type Band,
  type Report,
  type Slice,
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
   line and the donut are axes and arcs with hover, which is the work a
   library is for. The wave, the dials, the bands, the sentence columns
   and the tiles stay hand-drawn, as on the done screen, because a track
   and a marker is not a chart. */

export function RoundDetail({ report, length, pro }: { report: Report; length: number; pro: boolean }) {
  if (!report.heard) {
    return <p className="text-sm text-muted">We could not hear you. Check your microphone.</p>;
  }
  const rows = axes(report);
  const bars = rows.filter((row) => !row.noBar);
  const timed = report.pace_curve.length > 1;

  return (
    <div className="w-full">
      <MinuteBar report={report} length={length} ticks={report.filler_times} />
      <BarKey fillers={report.filler_times.length > 0} />
      <Headline report={report} />

      {/* First, and above the pace: the topic asked for something, and
          whether it was given comes before how it sounded. Free sees the
          same section drawn from one fixed round, blurred. */}
      {report.case ? (
        <Section title="Your answer">
          <CaseRead read={report.case} sentences={report.sentences} length={length} />
        </Section>
      ) : (
        !pro && (
          <Section title="Your answer" aside="a sample">
            <SampleRead />
          </Section>
        )
      )}

      {timed && (
        <Section
          title="Pace through the minute"
          aside={report.pace !== null ? `${report.pace} words a minute over the round` : undefined}
        >
          <PaceChart report={report} length={length} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{paceCaption(report)}</p>
        </Section>
      )}

      {pro ? (
        <Section title="How the round went" aside={shapeCaption(rows)}>
          <Dials rows={rows} />
          <Bands rows={bars} />
          {/* The bands draw your usual as a hollow ring and nothing on them
              says so. The radar's key used to; this is what is left of it. */}
          {report.usual && (
            <p className="mt-3 text-[11.5px] text-muted">
              The hollow dot on each bar is where you usually land, over your last {report.usual.rounds} rounds.
            </p>
          )}
        </Section>
      ) : (
        <Section title="How the round went" aside="a sample">
          <Sample
            title="Pro measures every round."
            line="Your pace, how fast you started, your longest pause, and your longest sentence, each against a comfortable range."
          >
            <Dials rows={axes(SAMPLE_REPORT)} />
            <Bands rows={axes(SAMPLE_REPORT).filter((row) => !row.noBar)} />
          </Sample>
        </Section>
      )}

      {report.words !== null && (
        <Section title="Words you used a lot" aside={leanAside(report)}>
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-8">
            <LeanedOn report={report} />
            <Repeats report={report} />
          </div>
        </Section>
      )}

      {/* The whole minute, not the short list above it: every word said,
          sized and shaded by how often (owner's call, from
          `mocks/words.html`). The section above answers what somebody
          leans on and this answers what the minute sounded like, which
          is why they are two sections and not one. */}
      {report.transcript && (
        <Section title="Words you used" aside={`${tally(report.transcript).length} different words`}>
          <WordCloud report={report} />
        </Section>
      )}

      {/* The sentences and the three tiles under them are Pro's, and free
          sees the same two drawn from one fixed round, blurred (owner's
          call). One card over both rather than one each: two overlays
          eight inches apart on the same scroll is nagging, and they
          answer the same question, which is what the last part of a
          round looked like. */}
      {pro ? (
        <>
          {report.sentences.length > 0 && (
            <Section title="Sentences" aside={sentenceAside(report)}>
              <Sentences report={report} />
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{sentenceCaption(report)}</p>
            </Section>
          )}

          <Tiles report={report} length={length} rows={rows} />
        </>
      ) : (
        <Section title="Sentences" aside="a sample">
          <Sample
            title="Pro measures every sentence."
            line="How long each one ran, when your first word came, and how many different words you used."
          >
            <Sentences report={SAMPLE_REPORT} />
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{sentenceCaption(SAMPLE_REPORT)}</p>
            <Tiles report={SAMPLE_REPORT} length={SAMPLE_LENGTH} rows={axes(SAMPLE_REPORT)} />
          </Sample>
        </Section>
      )}

      <Section title="What you said">
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
   flat line is nobody speaking, the warm line is a long pause. */
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
        <i className="inline-block w-3.5 border-t-[1.5px] border-line-strong" />a short pause
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block w-3.5 border-t-[3px] border-warn" />a long pause
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
              value: "a good pace, 130 to 170",
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
              return [`${value} words a minute`, `${clock(row.start)} to ${clock(row.end)}`];
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

/* Five dials, one a measure: the good stretch lit on the arc, the number
   in the middle, one word for where it landed (owner's call, drawing B in
   `mocks/shape-card.html`).

   It replaces a radar, and the radar's fault was not its drawing. It
   plotted how far inside its range each measure sat, so the point at the
   outer edge of an axis called "Fillers" meant hardly any ums: read as a
   picture it said the opposite of what it meant, and the owner read it
   that way on the live page. Naming the axes for their good end fixed the
   meaning and made the words too wide for a 250 pixel box. A dial has one
   direction and needs no key.

   Drawn by hand, like the bands and for the same reason: an arc and a dot
   is not a chart. It also takes the charting library out of this section,
   which now loads for the pace line alone. */

/* The length of the arc: a half circle of radius 34, which is what the
   dashes below are cut from. */
const ARC = Math.PI * 34;

function Dials({ rows }: { rows: Band[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5">
      {rows.map((row) => (
        <Dial key={row.key} band={row} />
      ))}
    </div>
  );
}

function Dial({ band }: { band: Band }) {
  const inside = band.value >= band.good[0] && band.value <= band.good[1];
  const from = at(band.good[0], band.scale) / 100;
  const to = at(band.good[1], band.scale) / 100;
  // Left end of the arc is the bottom of the scale, right end the top.
  const angle = Math.PI - (at(band.value, band.scale) / 100) * Math.PI;
  return (
    <div className="min-w-0 text-center">
      <svg viewBox="0 0 88 46" className="mx-auto block h-[54px] w-full max-w-[104px]" aria-hidden>
        <path d="M10 40 A34 34 0 0 1 78 40" fill="none" stroke="var(--line)" strokeWidth={8} strokeLinecap="round" />
        <path
          d="M10 40 A34 34 0 0 1 78 40"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.42}
          strokeWidth={8}
          strokeDasharray={`${(to - from) * ARC} ${ARC}`}
          strokeDashoffset={-from * ARC}
        />
        <circle
          cx={44 + 34 * Math.cos(angle)}
          cy={40 - 34 * Math.sin(angle)}
          r={5.5}
          fill={inside ? "var(--accent)" : "var(--poor)"}
          stroke="var(--surface)"
          strokeWidth={2.5}
        />
      </svg>
      {/* The number sits up inside the arc, which is what makes the pair
          read as one dial rather than as a picture with a caption. */}
      <div
        className={`-mt-3.5 font-display text-[19px] leading-none font-semibold tracking-[-0.02em] ${
          inside ? "" : "text-poor"
        }`}
      >
        {dialNumber(band)}
      </div>
      <div className={`mt-1.5 text-[11.5px] leading-tight font-semibold ${inside ? "text-accent-strong" : "text-poor"}`}>
        {band.verdict}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-muted">{band.label}</div>
    </div>
  );
}

/* ---------------------------------------------------------- leaned on */

function leanAside(report: Report): string {
  const parts = slices(report);
  const total = parts.reduce((sum, slice) => sum + slice.count, 0);
  const out = [`${total} of ${saidCount(report)} words`];
  const fillers = report.filler_counts.reduce((sum, filler) => sum + filler.count, 0);
  if (report.fillers_at_transitions !== null && fillers > 0) {
    out.push(`${report.fillers_at_transitions} um${report.fillers_at_transitions === 1 ? "" : "s"} after a pause`);
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
              <Group>Filler words</Group>
              {fillers.length ? fillers.map((slice) => <Row key={slice.word} slice={slice} />) : <Plain>No ums.</Plain>}
            </>
          ) : null}
          <Group>Words you use a lot</Group>
          {crutches.length ? crutches.map((slice) => <Row key={slice.word} slice={slice} />) : <Plain>None this time.</Plain>}
        </ul>
      </div>
      {report.fillers === null && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The free version removes the ums before we can count them.{" "}
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
    return <p className="text-[12.5px] text-muted">You said nothing twice, and you started no sentence twice.</p>;
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
            A restart is a sentence you started twice within a few seconds. You lost your place and went back to
            the beginning.
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
  return `${counts.length} sentence${counts.length === 1 ? "" : "s"} · ${mean} words on average`;
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
        <span>the line is at {RUN_ON} words</span>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- tiles */

/* The facts that are not a scale. Three columns and never two and one.

   The number turns rose where the round fell outside the range the bands
   already draw, so the row says at a glance which of the three to look at
   (owner's call, and the only place on the site that colour is used). The
   edge is read off the band rather than written again here: two copies of
   one threshold drift apart on the first edit. The third tile never turns
   - how many different words a minute holds has no comfortable range
   behind it, and colouring it would be a judgement with nothing under
   it. */
function Tiles({ report, length, rows }: { report: Report; length: number; rows: Band[] }) {
  const outside = (key: string) => {
    const row = rows.find((band) => band.key === key);
    return row !== undefined && (row.value < row.good[0] || row.value > row.good[1]);
  };
  const tiles: [string, string, boolean][] = [
    [clock(report.opening_stall), "to your first word", outside("start")],
    [
      clock(lastWord(report, length)),
      report.ended_clean ? "last word, at the end of a sentence" : "last word, in the middle of a sentence",
      !report.ended_clean,
    ],
  ];
  if (report.words !== null) {
    tiles.push([String(distinctWords(report)), `different words out of ${report.words}`, false]);
  }
  return (
    <div className={`mt-9 grid gap-2.5 ${tiles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {tiles.map(([number, label, poor]) => (
        <div key={label} className="min-w-0 rounded-card border border-line bg-card px-3 py-3.5">
          <div
            className={`text-[22px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[26px] ${
              poor ? "text-poor" : ""
            }`}
          >
            {number}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
