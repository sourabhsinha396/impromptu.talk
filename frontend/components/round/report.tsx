import { Button } from "@/components/site/button";
import { MicIcon } from "@/components/site/icons";
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


/* The one place the microphone is ever asked for.

   It sits in the slot the report will fill, after a round rather than
   before one, so the ask lands on somebody who has just spoken and is
   looking at what it was worth, and so enabling it puts the thing exactly
   where the ask was. Nothing about it appears on home or during a round:
   the ten-second rule outranks this, and an offer made while somebody is
   trying to think is one they refuse to get rid of it.

   The button names what you get, not what you give up. "Turn on the mic"
   is the cost; "Turn on feedback" is the reason, and the line under it is
   where the microphone is admitted to, because a prompt nobody was warned
   about is the thing this whole flow exists to avoid. */
export function ReportInvitation({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="rounded-card border border-line bg-card2 px-5 py-5 text-center">
      <MicIcon size={24} className="mx-auto mb-2.5 text-accent" />
      <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">Get feedback on every round</h3>
      <p className="mx-auto mt-1.5 max-w-[38ch] text-sm text-muted">
        A report on your pauses, your pace and the words you lean on.
      </p>
      <p className="mx-auto mt-1 max-w-[38ch] text-[12.5px] text-muted">
        Needs your microphone. We never keep the audio.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <Button size="sm" onClick={onYes}>
          Turn on feedback
        </Button>
        <Button size="sm" variant="ghost" onClick={onNo}>
          Not now
        </Button>
      </div>
    </div>
  );
}
