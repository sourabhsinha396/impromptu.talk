import { blocks, clock, headline, type Kind, type Report } from "@/lib/report";

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

  // Nothing yet: the run has landed and the transcriber has not. A quiet
  // placeholder the same height as the bar, so the buttons under it do not
  // jump when the words arrive.
  if (!report) return <div className="h-2 w-full animate-pulse rounded-full bg-line" aria-hidden />;

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
    </div>
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
  const out = [`${report.pauses.length} pause${report.pauses.length === 1 ? "" : "s"}`];
  if (report.opening_stall >= 1) out.push(`${clock(report.opening_stall)} to start`);
  if (report.pace !== null) out.push(`${report.pace} wpm`);
  if (report.fillers !== null) out.push(`${report.fillers} um`);
  return out;
}
