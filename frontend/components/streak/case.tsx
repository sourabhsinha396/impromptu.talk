import {
  ANSWERED_WORD,
  POINT_BY,
  ROLE_WORD,
  SAMPLE_CASE,
  SAMPLE_LENGTH,
  SAMPLE_ROUNDS,
  SAMPLE_SENTENCES,
  answeredCount,
  caseBlocks,
  hasPoint,
  pointAt,
  pointMoved,
  readRounds,
  rolesUsed,
} from "@/lib/case";
import { clock, type Case, type Role, type Round, type Sentence } from "@/lib/report";

/* What the topic asked for, and whether it was given.

   Everything else on this page says how a minute sounded. Run 30 answered
   "Argue for owning one good pen" with a story about a pen fight, and the
   page could report 143 words a minute and one um and never the thing the
   speaker most needed to hear.

   The model writes a role for each sentence, one word for whether the
   topic was answered and two short lines (`apps/runs/argument.py`).
   Everything drawn here is arithmetic over those: the blocks are the
   sentences on their own clock, the flag is the first sentence that made
   the point, the key holds only the roles this round used. Nothing here
   is a score and nothing here rewrites what somebody said. */

/* The point in the strong accent, support in the accent with an example
   paler than a reason, a wind-up hollow because it is talk before the
   talk started, an aside quiet, the close in ink. */
const PAINT: Record<Role, string> = {
  point: "bg-accent-strong",
  reason: "bg-accent",
  example: "bg-accent/40",
  setup: "border border-dashed border-line-strong",
  aside: "bg-line",
  close: "bg-ink",
  "": "bg-line",
};

const VERDICT: Record<Case["answered"], string> = {
  yes: "text-accent-strong dark:text-accent",
  half: "text-ink",
  no: "text-warn",
};

/* One locale and one zone, by hand, or the page fails to hydrate: Node
   and a phone disagree on the default locale and the default zone, and
   "Aug 29" against "29 Aug" is a mismatch React refuses. Caught on the
   live page, where every square in the row disagreed with itself. */
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/* Past this much of the round the flag would run off the right edge, so
   it hangs back from the mark instead of forward from it. */
const LATE = 0.72;

export function CaseRead({ read, sentences, length }: { read: Case; sentences: Sentence[]; length: number }) {
  const blocks = caseBlocks(sentences, length);
  const at = pointAt(sentences);
  const late = at !== null && at / length > LATE;

  return (
    <div>
      <p className="text-sm leading-relaxed">
        <span className={`mr-1 font-semibold ${VERDICT[read.answered]}`}>{ANSWERED_WORD[read.answered]}</span>
        {read.verdict}
      </p>

      {blocks.length > 0 && (
        <>
          <div className="relative mt-4 h-[46px]">
            {blocks.map((block, index) => (
              <span
                key={index}
                title={`${ROLE_WORD[block.role || "aside"]} · ${clock(block.start)}: ${block.text}`}
                className={`absolute top-[26px] h-3.5 rounded-[3px] ${PAINT[block.role]}`}
                style={{ left: `${block.at}%`, width: `calc(${block.width}% - 2px)` }}
              />
            ))}
            {at !== null ? (
              <span
                className={`absolute top-0.5 text-[11.5px] leading-none font-semibold tabular-nums text-accent-strong dark:text-accent ${
                  late ? "-translate-x-full" : ""
                }`}
                style={{ left: `${(at / length) * 100}%` }}
              >
                your point, {clock(at)}
                <span
                  aria-hidden
                  className={`absolute top-3.5 h-2.5 w-px bg-accent-strong dark:bg-accent ${late ? "right-0" : "left-0"}`}
                />
              </span>
            ) : (
              /* Said only when no sentence made one. A round that made its
                 point and could not be timed says nothing rather than
                 accusing somebody of a miss they did not make. */
              !hasPoint(sentences) && (
                <span className="absolute top-0.5 right-0 text-[11.5px] leading-none font-semibold text-warn">
                  no point made
                </span>
              )
            )}
          </div>
          <div className="flex justify-between text-[11px] tabular-nums text-muted">
            <span>0:00</span>
            <span>{clock(length)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-muted">
            {rolesUsed(sentences).map((role) => (
              <span key={role}>
                <i className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px] ${PAINT[role]}`} />
                {ROLE_WORD[role]}
              </span>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-[13.5px] leading-relaxed">
        <span className="font-semibold">Next time.</span> {read.advice}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- the sample */

/* One fixed round behind a blur, where a Pro round shows their own. Not
   their own round blurred: nothing read it, so there is nothing of theirs
   back there, and a blur over what does not exist reads as a fault
   rather than a door. */
export function Sample({ line, children }: { line: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none blur-[5px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="mx-4 max-w-[36ch] rounded-card border border-line-strong bg-card px-4 py-3.5 text-center text-[13.5px] leading-relaxed shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
          <span className="block font-semibold">Pro reads what you said.</span>
          {line}{" "}
          <a href="/pro" className="font-semibold text-accent-strong underline underline-offset-3 dark:text-accent">
            See Pro
          </a>
        </div>
      </div>
    </div>
  );
}

export function SampleRead() {
  return (
    <Sample line="Did you answer it, where your point came, what to do next time.">
      <CaseRead read={SAMPLE_CASE} sentences={SAMPLE_SENTENCES} length={SAMPLE_LENGTH} />
    </Sample>
  );
}

export function SampleCards() {
  return (
    <Sample line="Whether you answered the topic, and how fast you got to the point.">
      <CaseCards rounds={SAMPLE_ROUNDS} />
    </Sample>
  );
}

/* ----------------------------------------------------- across the weeks */

/* The case as a trend, which is the question this page is for. One row of
   two, so a phone stacks them and a laptop never wraps two and one. */
export function CaseCards({ rounds }: { rounds: Round[] }) {
  const shown = readRounds(rounds);
  if (!shown.length) return null;
  const answered = answeredCount(shown);
  const moved = pointMoved(shown);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-card border border-line bg-card px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="font-semibold">Answered the topic</span>
          <span className="font-semibold tabular-nums">
            {answered} of {shown.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted">
          your last {shown.length === 1 ? "round" : `${shown.length} rounds`}
        </p>
        <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(shown.length, 1)}, 1fr)` }}>
          {shown.map((round) => (
            <i
              key={round.id}
              title={`${DAY.format(new Date(round.at))}: ${ANSWERED_WORD[round.answered ?? "no"]}`}
              className={`block aspect-square rounded-[3px] ${SQUARE[round.answered ?? "no"]}`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>oldest</span>
          <span>latest</span>
        </div>
      </div>

      <div className="rounded-card border border-line bg-card px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <span className="font-semibold">Time to your point</span>
          <span className="font-semibold tabular-nums">{moved ? `${moved.to}s` : "not yet"}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted">
          {moved
            ? /* Better and worse, never up and down: lower is better here
                 and nobody should have to hold that in their head. */
              moved.to < moved.from
                ? `was ${moved.from}s · better`
                : moved.to > moved.from
                  ? `was ${moved.from}s · worse`
                  : `steady at ${moved.from}s`
            : "when a round makes its point"}
        </p>
        <PointLine rounds={shown} />
      </div>
    </div>
  );
}

/* Filled where the topic was answered, half filled where it was half
   answered, warm where it was missed. */
const SQUARE: Record<"yes" | "half" | "no", string> = {
  yes: "bg-accent",
  half: "bg-[linear-gradient(to_top,var(--accent)_50%,var(--line)_50%)]",
  no: "bg-warn/40",
};

/* Seconds to the point, round by round, against the stretch that counts
   as reaching it at once. Drawn by hand rather than with the charting
   library: ten points, no axes and one shaded band is a track with a
   line on it, and the library is loaded here for the round page's real
   charts. */
function PointLine({ rounds }: { rounds: Round[] }) {
  const times = rounds.map((round) => round.point_at);
  const known = times.filter((at): at is number => at !== null);
  if (known.length < 2) return <div className="mt-2 h-[52px]" />;

  const width = 300;
  const height = 52;
  const top = 6;
  const most = Math.max(POINT_BY * 2, ...known);
  const x = (index: number) => (index / Math.max(times.length - 1, 1)) * width;
  const y = (value: number) => top + (1 - value / most) * (height - top);
  const points = times
    .map((at, index) => (at === null ? null : `${x(index).toFixed(1)},${y(at).toFixed(1)}`))
    .filter((point): point is string => point !== null);

  return (
    <div className="relative mt-2 h-[52px]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <rect x={0} y={y(POINT_BY)} width={width} height={height - y(POINT_BY)} className="fill-accent opacity-[0.12]" />
        <polyline
          points={points.join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {times.map((at, index) =>
          at === null ? null : (
            <circle key={index} cx={x(index)} cy={y(at)} r={3.5} className={at > POINT_BY ? "fill-warn" : "fill-accent"} />
          ),
        )}
      </svg>
      {/* The edge said in words, where the shading starts, so nobody has
          to read a number off an axis that is not drawn. */}
      <span className="absolute right-0 text-[11px] text-muted" style={{ top: `${y(POINT_BY) - 15}px` }}>
        under {POINT_BY}s
      </span>
    </div>
  );
}

