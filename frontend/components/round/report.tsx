import { Button } from "@/components/site/button";
import { MicIcon } from "@/components/site/icons";
import { at, bands, blocks, clock, headline, marked, type Band, type Kind, type Report } from "@/lib/report";

/* The minute you just spoke, drawn.

   One bar and one sentence, in that order, because the bar is the thing
   that needs no reading: you see the six-second hole and the cluster
   before it at a glance, and no number does that as fast. Everything else
   on this screen is small and underneath.

   Deliberately not a dashboard. The done screen is a moment, and the
   report never rewrites anybody's words: a paragraph of advice from a
   model cannot be plotted, so a report made of paragraphs would mean the
   progress view could never exist. */

export function RoundReport({ report, length }: { report: Report | "off" | null; length: number }) {
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

  const parts = blocks(report, length);
  return (
    <div className="w-full">
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`Your minute: ${report.pauses.length} pauses, longest ${report.longest_pause} seconds`}
      >
        {parts.map((block, index) => (
          <span
            key={index}
            className={`absolute inset-y-0 ${PAINT[block.kind]}`}
            style={{ left: `${block.at}%`, width: `${block.width}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
        <span>0:00</span>
        <span>{clock(length)}</span>
      </div>

      <p className="mt-4 text-sm font-semibold">{headline(report)}</p>

      <p className="mt-2 text-[12.5px] tabular-nums text-muted">{numbers(report).join("  ·  ")}</p>

      {report.crutch_words.length > 0 && (
        <p className="mt-1 text-[12.5px] text-muted">
          You leaned on {report.crutch_words.map((crutch) => `${crutch.word} ${crutch.count}`).join(", ")}
        </p>
      )}

      <Bands report={report} />

      <Transcript report={report} />
    </div>
  );
}

/* What you actually said, with what was counted marked in it.

   Stored since the report shipped and never shown until now. Reading your
   own minute back is the most convincing thing here after the bar, and it
   is the only place a filler count stops being a number and becomes a
   thing you can hear yourself doing. */
function Transcript({ report }: { report: Report }) {
  const parts = marked(report);
  if (!parts.length) return null;
  return (
    <details className="group mt-5 text-left">
      <summary className="cursor-pointer list-none text-center text-[12.5px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
        <span className="group-open:hidden">Read it back</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <p className="mt-3 rounded-card border border-line bg-card2 px-4 py-3.5 text-[13.5px] leading-relaxed text-muted">
        {parts.map((part, index) =>
          part.kind ? (
            <mark
              key={index}
              className={
                part.kind === "filler"
                  ? "rounded-[3px] bg-warn/20 px-0.5 font-semibold text-ink"
                  : "rounded-[3px] bg-accent/15 px-0.5 font-semibold text-ink"
              }
            >
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
    </details>
  );
}

/* Talking is the accent, a gap long enough to notice is the warm colour
   the clock already uses for its last ten seconds, and an ordinary breath
   is a line. Finishing early is none of the three and keeps the track's
   own background: answering in twenty seconds is a short answer, not a
   forty-second hole, and the first version of this bar said otherwise. */
const PAINT: Record<Kind, string> = {
  talking: "bg-accent",
  gap: "bg-warn",
  breath: "bg-line-strong",
  after: "bg-transparent",
};

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
   progress view is where axes and hover start to earn a library. */
function Bands({ report }: { report: Report }) {
  const rows = bands(report);
  if (!rows.length) return null;
  return (
    <div className="mt-6 grid gap-4 text-left sm:grid-cols-2">
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

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold">{band.label}</span>
        <span className="text-[12.5px] tabular-nums text-muted">{band.shown}</span>
      </div>
      <div className="relative mt-2 h-1.5 w-full rounded-full bg-line">
        {/* The comfortable stretch, and then where you landed on it. */}
        <span
          className="absolute inset-y-0 rounded-full bg-accent/30"
          style={{ left: `${start}%`, width: `${width}%` }}
        />
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
    </div>
  );
}
