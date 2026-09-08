import { Button } from "@/components/site/button";
import { MicIcon } from "@/components/site/icons";
import { Ping } from "@/components/site/ping";
import {
  advice,
  at,
  bands,
  blocks,
  clock,
  headline,
  marked,
  waveform,
  type Band,
  type FillerAt,
  type Report,
} from "@/lib/report";

/* The minute you just spoke, drawn.

   One bar and one sentence, in that order, because the bar is the thing
   that needs no reading: you see the six-second hole and the cluster
   before it at a glance, and no number does that as fast. Everything else
   on this screen is small and underneath.

   Deliberately not a dashboard. The done screen is a moment, and the
   report never rewrites anybody's words: a paragraph of advice from a
   model cannot be plotted, so a report made of paragraphs would mean the
   progress view could never exist. The full reading, with the charts,
   lives on the round's own page, and this screen only links to it.

   The pieces are exported one by one so that page can compose the same
   bar, sentence, bands and read-back rather than draw its own and drift. */

export function RoundReport({
  report,
  length,
  href,
}: {
  report: Report | "off" | null;
  length: number;
  /* The round's own page, once there is a row to hang it on. */
  href?: string;
}) {
  // No microphone behind this round, so there is nothing to say about it.
  // Silence, rather than an apology for a feature nobody asked for.
  if (report === "off") return null;

  // The run has landed and the transcriber has not. Saying so matters:
  // an unexplained blank where a report should be reads as a feature that
  // did not work, and this can take a few seconds.
  if (!report) {
    return (
      <div className="text-center" role="status">
        <div className="h-2 w-full animate-pulse rounded-full bg-line" />
        <p className="mt-3 text-[13px] text-muted">Reading your round back...</p>
      </div>
    );
  }

  if (!report.heard) {
    return <p className="text-sm text-muted">We could not hear you. Check your microphone.</p>;
  }

  return (
    <div className="w-full">
      <MinuteBar report={report} length={length} />
      <Headline report={report} />
      <Bands rows={bands(report)} />
      <Transcript report={report} />
      {href && (
        /* The ping sits after the link rather than on it: the underline
           already says the words are pressable, and this says which of the
           several pressable things on the done screen is the one nobody
           has found yet. */
        <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px]">
          <a href={href} className="font-semibold text-accent-strong underline underline-offset-4 hover:text-ink">
            See the full report
          </a>
          <Ping />
        </p>
      )}
    </div>
  );
}

/* The tones of the wave. A voice is the accent, a gap long enough to
   notice is the warm colour the clock already uses for its last ten
   seconds, an ordinary breath is a hairline. Finishing early is none of
   the three and draws nothing: answering in twenty seconds is a short
   answer, not a forty-second hole, and the first version of this bar
   said otherwise. */
const TONE: Record<"breath" | "gap", { stroke: string; width: number }> = {
  breath: { stroke: "var(--line-strong)", width: 1.5 },
  gap: { stroke: "var(--warn)", width: 3 },
};

/* The minute as a waveform: strokes where you were talking, a flat line
   where you were not, and, when asked for, each um as a warm dot on the
   line at the second it was said, so "six ums" becomes "six ums, all in
   the first half", which is the thing you can do something about.

   Drawn in percent with the strokes kept at their pixel width, so the
   same round is the same picture at every size. The heights are a texture
   and not loudness: nothing here knows how loud anybody was. */
export function MinuteBar({ report, length, ticks = [] }: { report: Report; length: number; ticks?: FillerAt[] }) {
  const marks = waveform(blocks(report, length));
  return (
    <>
      <div className="relative w-full">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="block h-10 w-full overflow-visible"
          role="img"
          aria-label={`Your minute: ${report.pauses.length} pauses, longest ${report.longest_pause} seconds`}
        >
          {marks.map((mark, index) =>
            mark.kind === "stroke" ? (
              <line
                key={index}
                x1={mark.x}
                x2={mark.x}
                y1={20 - mark.height * 18}
                y2={20 + mark.height * 18}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <line
                key={index}
                x1={mark.from}
                x2={mark.to}
                y1={20}
                y2={20}
                stroke={TONE[mark.tone].stroke}
                strokeWidth={TONE[mark.tone].width}
                vectorEffect="non-scaling-stroke"
              >
                <title>{mark.tone === "gap" ? `A ${mark.seconds}s gap` : `A ${mark.seconds}s breath`}</title>
              </line>
            ),
          )}
        </svg>
        {ticks.map((tick, index) => (
          <span
            key={index}
            title={`${tick.word} at ${clock(tick.at)}`}
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn ring-2 ring-surface"
            style={{ left: `${Math.min(100, (tick.at / length) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
        <span>0:00</span>
        <span>{clock(length)}</span>
      </div>
    </>
  );
}

/* One sentence, then the plain numbers, then what was leaned on. */
export function Headline({ report }: { report: Report }) {
  return (
    <>
      <p className="mt-4 text-sm font-semibold">{headline(report)}</p>

      <p className="mt-2 text-[12.5px] tabular-nums text-muted">{numbers(report).join("  ·  ")}</p>

      {report.fillers !== null && report.fillers_at_transitions !== null && report.fillers > 0 && (
        <p className="mt-1 text-[12.5px] text-muted">
          {report.fillers_at_transitions === 0
            ? "None of them at a gap, so it is a habit rather than hunting."
            : `${report.fillers_at_transitions} of them beside a gap, where the next point was not ready.`}
        </p>
      )}
    </>
  );
}

/* What you actually said, with what was counted marked in it.

   Stored since the report shipped and never shown until now. Reading your
   own minute back is the most convincing thing here after the bar, and it
   is the only place a filler count stops being a number and becomes a
   thing you can hear yourself doing. Behind a link on the done screen,
   which is a moment; open on the round's own page, which is the record. */
export function Transcript({ report, open = false }: { report: Report; open?: boolean }) {
  const parts = marked(report);
  if (!parts.length && !report.said.length) return null;
  const body = (
    <div className={`rounded-card border border-line bg-card2 px-4 py-3.5 ${open ? "" : "mt-3"}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
        {/* The topic, so the read-back says what it was an answer to.
            Months later a transcript on its own is a paragraph nobody
            can place. */}
        <p className="text-[12.5px] font-semibold">{report.topic}</p>
        {report.words !== null && (
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{report.words} words</span>
        )}
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
        {report.said.length ? <Timed report={report} /> : <Flat parts={parts} />}
      </p>
    </div>
  );
  if (open) return body;
  return (
    <details className="group mt-5 text-left">
      <summary className="cursor-pointer list-none text-center text-[12.5px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
        <span className="group-open:hidden">Read it back</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      {body}
    </details>
  );
}

/* Only what was actually measured. A round nothing transcribed shows the
   timing numbers and stops; a round Whisper transcribed shows the words
   and not the ums, because Whisper deletes those before anybody asks and
   a zero there would be an undercount presented as a fact. */
function numbers(report: Report): string[] {
  // Not the raw pause count. A minute of ordinary speech breathes twenty
  // times and reporting that as twenty pauses reads like an accusation
  // while telling nobody anything; the gaps long enough for a listener to
  // notice are the ones worth acting on.
  const out = [`${report.awkward_pauses} long gap${report.awkward_pauses === 1 ? "" : "s"}`];
  if (report.opening_stall >= 1) out.push(`${clock(report.opening_stall)} to start`);
  if (report.pace !== null) out.push(`${report.pace} wpm`);
  if (report.fillers !== null) out.push(`${report.fillers} um`);
  return out;
}

/* The one place the microphone is ever asked for.

   On home, under the button, and not on the done screen: an offer that
   waits is less pushy than one that appears in your face the moment you
   finish, and turning it on before the first round means the first round
   is the one that gets a report, which is the round where seeing your own
   pauses lands hardest. Never on the topic screen, which competes with
   the topic at the moment of most focus (owner's call).

   Its action is a ghost button on purpose. Spin is the ink primary and
   the primary button's colour never moves; a second ink button on the
   same screen would be a second primary, and the ten-second rule says
   there is exactly one.

   The button names what you get, not what you give up. "Turn on the mic"
   is the cost; "Turn on feedback" is the reason. The microphone is
   admitted to in the line under it, because a prompt nobody was warned
   about is the thing this whole flow exists to avoid. */
export function ReportInvitation({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-card border border-line bg-card2 px-5 py-4 text-center">
      <p className="flex items-center justify-center gap-2 text-[15px] font-semibold">
        <MicIcon size={16} className="text-accent" />
        Get feedback on every round
      </p>
      <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-muted">
        A report on your pauses, your pace and the words you lean on. Needs your microphone, and we never keep the
        audio.
      </p>
      {/* A ghost button and a word, not two buttons. There are only two
          variants and the primary is ink, which belongs to Spin on this
          screen; two ghosts side by side would read as one choice made
          twice. So the refusal is a link, the way Reset already is. */}
      <div className="mt-3.5 flex flex-col items-center gap-2.5">
        <Button size="sm" variant="ghost" onClick={onYes}>
          Turn on feedback
        </Button>
        <button
          type="button"
          onClick={onNo}
          className="cursor-pointer text-[13px] text-muted underline underline-offset-4 hover:text-ink"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

/* Every number against a comfortable range.

   This is what stops a first round being a page of orphaned facts. "166
   wpm" says nothing to somebody who has never seen the number before;
   "166, and comfortable is 130 to 170" says it in one look, with no
   history behind it and nothing to compare against but the range itself.

   Drawn by hand rather than by a chart library. A track, a band and a
   marker is not a chart, and the alternative would put a hundred kilobytes
   of charting on the home page, where the first paint is measured. The
   round's own page is where axes and hover start to earn a library. */
export function Bands({ rows, columns = 2 }: { rows: Band[]; columns?: 1 | 2 }) {
  if (!rows.length) return null;
  return (
    <div className={`mt-6 grid gap-4 text-left ${columns === 2 ? "sm:grid-cols-2" : "sm:mt-0"}`}>
      {rows.map((row) => (
        <BandRow key={row.key} band={row} />
      ))}
    </div>
  );
}

function BandRow({ band }: { band: Band }) {
  const start = at(band.good[0], band.scale);
  const width = at(band.good[1], band.scale) - start;
  const mark = at(band.value, band.scale);
  const inside = band.value >= band.good[0] && band.value <= band.good[1];
  const todo = advice(band);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{band.label}</span>
        <span className="text-[12.5px] tabular-nums text-muted">{band.shown}</span>
      </div>
      <div className="relative mt-2 h-1.5 w-full rounded-full bg-line">
        {/* The comfortable stretch, then where you usually land, then
            where you landed today on top of both. */}
        <span
          className="absolute inset-y-0 rounded-full bg-accent/30"
          style={{ left: `${start}%`, width: `${width}%` }}
        />
        {band.usual !== null && band.usual !== undefined && (
          <span
            title={`Your usual: ${band.usual}`}
            className="absolute -top-[3px] size-3 -translate-x-1/2 rounded-full border-2 border-muted bg-surface"
            style={{ left: `${at(band.usual, band.scale)}%` }}
          />
        )}
        <span
          className={`absolute -top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-surface ${
            inside ? "bg-accent" : "bg-warn"
          }`}
          style={{ left: `${mark}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px] text-muted">
        <span>{band.ends[0]}</span>
        <span className={`font-semibold ${inside ? "text-accent-strong" : "text-ink"}`}>{band.verdict}</span>
        <span>{band.ends[1]}</span>
      </div>
      {/* One thing to do, and only where there is something to do. Behind
          a disclosure because the verdict is a word and the done screen is
          a moment, not a lecture. */}
      {todo && (
        <details className="group mt-1.5">
          <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
            <span className="group-open:hidden">What to do</span>
            <span className="hidden group-open:inline">Hide</span>
          </summary>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{todo}</p>
        </details>
      )}
    </div>
  );
}

/* The silences drawn where they fell.

   A six-second hole reported as "longest gap 6s" is a number. The same
   hole sitting inside the sentence it interrupted tells you where you
   stalled, which is the thing you can actually fix. The words and their
   clock come from the transcriber; the silence is our own, measured off
   the envelope, which is the more exact of the two. A restart, the two
   words a sentence was begun on twice, is underlined in the warm colour
   where it happened. */
function Timed({ report }: { report: Report }) {
  const restarts = new Set(report.restarts.map((restart) => restart.at));
  let underline = 0;
  return (
    <>
      {report.said.map((part, index) => {
        if (part.kind === "pause") {
          return (
            <span
              key={index}
              className={`mx-1 inline-block rounded-[4px] px-1 align-middle text-[11px] font-semibold tabular-nums ${
                part.awkward ? "bg-warn/25 text-ink" : "bg-line text-muted"
              }`}
              title={part.awkward ? "Long enough to notice" : "A breath"}
            >
              {part.seconds}s
            </span>
          );
        }
        if (restarts.has(part.at)) underline = 2;
        const said =
          part.kind === "word" ? (
            <>{part.text} </>
          ) : (
            <mark
              className={`rounded-[3px] px-0.5 font-semibold text-ink ${
                part.kind === "filler" ? "bg-warn/20" : "bg-accent/15"
              }`}
            >
              {part.text}{" "}
            </mark>
          );
        if (underline > 0 && part.kind !== "filler") {
          underline -= 1;
          return (
            <u key={index} className="text-ink decoration-warn decoration-dotted decoration-2 underline-offset-[3px]">
              {said}
            </u>
          );
        }
        return <span key={index}>{said}</span>;
      })}
    </>
  );
}

/* Where the transcriber sent no word timings, the words still get marked;
   only the silences cannot be placed. */
function Flat({ parts }: { parts: ReturnType<typeof marked> }) {
  return (
    <>
      {parts.map((part, index) =>
        part.kind ? (
          <mark
            key={index}
            className={`rounded-[3px] px-0.5 font-semibold text-ink ${
              part.kind === "filler" ? "bg-warn/20" : "bg-accent/15"
            }`}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
