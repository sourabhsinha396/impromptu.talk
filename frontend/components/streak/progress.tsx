"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { minuteBlocks, movement, type Kind, type Point, type Progress } from "@/lib/report";

/* Whether somebody is getting better, which is the thing Pro sells.

   A single round's report answers "how did that go". Only this answers
   "am I improving", and that is the question a habit product is for: a
   report you cannot compare is a readout, and nobody renews a readout.

   Recharts here and nowhere else. Axes, hover and resize are real work
   and a library does them properly; the done screen's bar and bands are a
   track and a marker, so drawing those by hand keeps a hundred kilobytes
   of charting off the home page, where the first paint is measured. This
   page is noindex and is reached on purpose.

   The three metrics are the ones that improve with practice, are
   unambiguous and do not swing with the topic. Pace is deliberately
   absent: a hot take and a story are spoken at different speeds, so a
   pace line across mixed genres wanders for reasons that have nothing to
   do with the speaker, and a chart that says "worse" on a day somebody
   did fine is worse than no chart. */

const PAINT: Record<Kind, string> = {
  talking: "bg-accent",
  gap: "bg-warn",
  breath: "bg-line-strong",
  after: "bg-transparent",
};

type Metric = {
  key: string;
  label: string;
  pick: (point: Point) => number | null;
  unit: string;
};

/* Lower is better on all three, so a fall is always the good direction and
   the arrow never has to be explained. */
const METRICS: Metric[] = [
  { key: "stall", label: "Time to start", pick: (p) => p.stall, unit: "s" },
  { key: "gap", label: "Longest gap", pick: (p) => p.gap, unit: "s" },
  { key: "fillers", label: "Ums a minute", pick: (p) => p.fillers, unit: "" },
];

export function ProgressSection({ progress }: { progress: Progress }) {
  if (!progress.enough) {
    return (
      <p className="text-sm text-muted">
        {progress.needed === 1 ? "One more round" : `${progress.needed} more rounds`} and your trend appears here.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {METRICS.map((metric) => (
          <Trend key={metric.key} metric={metric} points={progress.points} />
        ))}
      </div>
      <SideBySide progress={progress} />
    </div>
  );
}

function Trend({ metric, points }: { metric: Metric; points: Point[] }) {
  const moved = movement(points, metric.pick);
  const data = points.map((point, index) => ({ index, value: metric.pick(point) }));
  const has = data.some((row) => row.value !== null);

  return (
    <div className="rounded-card border border-line bg-card px-4 pt-3.5 pb-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{metric.label}</span>
        {moved && (
          <span className="text-[12.5px] font-semibold tabular-nums">
            {moved.to}
            {metric.unit}
          </span>
        )}
      </div>
      {moved ? (
        <p className="mt-0.5 text-[11.5px] text-muted">
          {/* Said as a change rather than a grade. Nobody is told they are
              good or bad at speaking, only what moved and which way. */}
          {moved.to < moved.from ? "down from" : moved.to > moved.from ? "up from" : "steady at"} {moved.from}
          {metric.unit}
        </p>
      ) : (
        <p className="mt-0.5 text-[11.5px] text-muted">Not counted yet</p>
      )}
      <div className={has ? "mt-2 h-[52px]" : ""}>
        {has && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* No axes drawn. The number above says where it is now and
                  the line only has to say which way it went. */}
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelFormatter={() => ""}
                formatter={(value) => [`${value}${metric.unit}`, metric.label]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                fill={`url(#fill-${metric.key})`}
                connectNulls
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* The first minute above the latest, at the same scale.

   The most convincing thing this product can show, and it costs nothing
   beyond what is already stored: a bar full of holes becoming a bar that
   is mostly solid, with no number to read and no claim to argue with. */
function SideBySide({ progress }: { progress: Progress }) {
  const { first, latest } = progress;
  if (!first || !latest || first.at === latest.at) return null;
  const scale = Math.max(first.seconds, latest.seconds);
  return (
    <div className="mt-6">
      <p className="text-[12.5px] font-semibold">Your first minute, and your latest</p>
      <div className="mt-3 space-y-3">
        <Bar label="First" minute={first} scale={scale} />
        <Bar label="Latest" minute={latest} scale={scale} />
      </div>
    </div>
  );
}

function Bar({ label, minute, scale }: { label: string; minute: { seconds: number; segments: number[][] }; scale: number }) {
  const parts = minuteBlocks(minute.segments, scale);
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 shrink-0 text-[11.5px] text-muted">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line">
        {parts.map((part, index) => (
          <span
            key={index}
            className={`absolute inset-y-0 ${PAINT[part.kind]}`}
            style={{ left: `${part.at}%`, width: `${part.width}%` }}
          />
        ))}
      </div>
    </div>
  );
}
