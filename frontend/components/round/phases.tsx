import { ReportInvitation, RoundReport } from "@/components/round/report";
import { Ring } from "@/components/round/ring";
import { Button } from "@/components/site/button";
import { FlameIcon, GenreIcon, MinutesIcon, PauseIcon, PlayIcon, StyleIcon, TopicsIcon } from "@/components/site/icons";
import { LogoMark } from "@/components/site/logo";
import type { Topic } from "@/lib/bank";
import type { Report } from "@/lib/report";
import { MAX_NOTE } from "@/lib/round/engine";

/* The phases inside the round, as approved in docs/mocks/home.html. Each
   is presentational: it draws what the engine says and hands back presses.
   The row holds only what moves you forward, primary first; Reset is a
   word under it, and it leaves and keeps nothing. */

/* A length as words. The sliders step in whole minutes, but a pref saved
   before they did can still hold seconds, so this keeps saying what those
   are rather than rounding somebody's setting behind their back. */
export function lengthWords(seconds: number): string {
  if (!seconds) return "None";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} min${rest ? ` ${rest}s` : ""}`;
}

/* What the primary button on the topic screen does, said as the duration
   it will run for. With no thinking time the button does not think: it
   starts the talking, and "Think for None" would describe the setting
   rather than what pressing it does. */
export function thinkLabel(prepSeconds: number): string {
  if (!prepSeconds) return "Start talking";
  if (prepSeconds === 60) return "Think for a minute";
  if (prepSeconds % 60 === 0) return `Think for ${prepSeconds / 60} minutes`;
  return `Think for ${lengthWords(prepSeconds)}`;
}

function Reset({ onReset, label = "Reset" }: { onReset: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="mt-5 inline-block cursor-pointer text-[13.5px] font-semibold text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
    >
      {label}
    </button>
  );
}

/* Every button in a row is the same size; the fill alone says which one
   is the default. */
const ROW = "flex flex-wrap items-center justify-center gap-3";

export function TopicPhase({
  topic,
  genre,
  styleLabel,
  prepSeconds,
  onThink,
  onSpeakNow,
  onSpin,
  onReset,
}: {
  topic: Topic;
  genre: { name: string; icon: string };
  styleLabel: string;
  prepSeconds: number;
  onThink: () => void;
  onSpeakNow: () => void;
  onSpin: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="inline-flex items-center gap-3.5 text-[13px] font-semibold tracking-[0.02em] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <GenreIcon icon={genre.icon} className="text-accent" />
          {genre.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StyleIcon style={topic.style} className="text-accent" />
          {styleLabel}
        </span>
      </div>
      <p className="mt-5 mb-11 font-display text-topic font-semibold text-accent text-balance">{topic.text}</p>
      <div className={ROW}>
        <Button size="lg" onClick={onThink}>
          {thinkLabel(prepSeconds)}
        </Button>
        {prepSeconds > 0 && (
          <Button size="lg" variant="ghost" onClick={onSpeakNow}>
            Speak now
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onSpin} aria-label="Spin for another topic">
          <LogoMark className="size-[1em]" />
          Spin
        </Button>
      </div>
      <Reset onReset={onReset} />
    </>
  );
}

type Clock = { fraction: number; text: string; ending: boolean; paused: boolean };

function PauseButton({ paused, onPause }: { paused: boolean; onPause: () => void }) {
  return (
    <Button size="lg" variant="ghost" onClick={onPause} aria-pressed={paused}>
      {paused ? <PlayIcon /> : <PauseIcon />}
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}

export function PrepPhase({
  topic,
  clock,
  notes,
  onNote,
  onPause,
  onSpeakNow,
  onReset,
}: {
  topic: Topic;
  clock: Clock;
  notes: string[];
  onNote: (index: number, text: string) => void;
  onPause: () => void;
  onSpeakNow: () => void;
  onReset: () => void;
}) {
  const tilts = ["-rotate-[1.2deg]", "rotate-[0.9deg]", "-rotate-[0.6deg]"];
  return (
    <>
      <p className="mb-7 font-display text-topic-mid font-semibold text-accent text-balance">{topic.text}</p>
      <Ring fraction={clock.fraction} text={clock.text} label="Think" ending={clock.ending} />
      <div className="mb-8 flex flex-wrap justify-center gap-4.5">
        {notes.map((note, index) => (
          <div key={index} className={`relative w-full max-w-[190px] ${tilts[index]}`}>
            <textarea
              aria-label={`Note ${index + 1}`}
              value={note}
              maxLength={MAX_NOTE}
              placeholder="Three words"
              autoFocus={index === 0}
              onChange={(event) => onNote(index, event.target.value)}
              className="ph-no-capture block h-[150px] w-full resize-none rounded-[3px] bg-note p-3.5 text-left text-[17px] leading-[1.3] font-semibold text-note-ink shadow-[0_8px_24px_rgb(0_0_0/0.12)] placeholder:text-note-ink/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <span className="absolute right-2.5 bottom-2 text-[11px] font-semibold text-note-ink/55" aria-hidden>
              {note.length}/{MAX_NOTE}
            </span>
          </div>
        ))}
      </div>
      <div className={ROW}>
        <Button size="lg" onClick={onSpeakNow}>
          Speak now
        </Button>
        <PauseButton paused={clock.paused} onPause={onPause} />
      </div>
      <Reset onReset={onReset} />
      <p className="mt-6 max-w-[44ch] text-sm text-muted">Three words per note. Don't write sentences - you'll read them.</p>
    </>
  );
}

export function SpeakPhase({
  topic,
  clock,
  notes,
  onPause,
  onDone,
  onReset,
}: {
  topic: Topic;
  clock: Clock;
  notes: string[];
  onPause: () => void;
  onDone: () => void;
  onReset: () => void;
}) {
  const chips = notes.filter((note) => note.trim());
  return (
    <>
      <p className="mb-7 font-display text-topic-mid font-semibold text-accent text-balance">{topic.text}</p>
      <Ring fraction={clock.fraction} text={clock.text} label="Speak" ending={clock.ending} />
      {chips.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {chips.map((chip, index) => (
            <span key={index} className="ph-no-capture rounded-[3px] bg-note px-[11px] py-[7px] text-[13px] font-semibold text-note-ink">
              {chip}
            </span>
          ))}
        </div>
      )}
      <div className={ROW}>
        <Button size="lg" onClick={onDone}>
          Done
        </Button>
        <PauseButton paused={clock.paused} onPause={onPause} />
      </div>
      <Reset onReset={onReset} label="Reset, without keeping this round" />
    </>
  );
}

export type Summary = { streak: number; topics: number; minutes: number };

export function DonePhase({
  summary,
  report,
  spokenSeconds,
  offerMic,
  onMicYes,
  onMicNo,
  signedIn,
  onAgain,
  onSame,
}: {
  summary: Summary | null;
  report: Report | "off" | null;
  spokenSeconds: number;
  offerMic: boolean;
  onMicYes: () => void;
  onMicNo: () => void;
  signedIn: boolean;
  onAgain: () => void;
  onSame: () => void;
}) {
  const headline = summary && summary.streak > 1 ? `Day ${summary.streak}.` : "Nice.";
  return (
    <>
      <p className="font-display text-headline font-semibold">{headline}</p>
      {/* The minute comes before the tiles. The streak is already in the
          header pill on every page; the done screen's own job is to say
          something about the sixty seconds that just happened. */}
      <div className="mx-auto mt-8 w-full max-w-[640px]">
        {offerMic ? (
          <ReportInvitation onYes={onMicYes} onNo={onMicNo} />
        ) : (
          <RoundReport report={report} length={spokenSeconds} />
        )}
      </div>
      {summary && (
        <div className="mx-auto mt-8 mb-9 w-full max-w-[640px]">
          <Stats streak={summary.streak} topics={summary.topics} minutes={summary.minutes} />
        </div>
      )}
      <div className={ROW}>
        <Button size="lg" onClick={onAgain}>
          <LogoMark className="size-[1em]" />
          Spin again
        </Button>
        <Button size="lg" variant="ghost" onClick={onSame}>
          Same topic
        </Button>
      </div>
      {!signedIn && (
        <p className="mt-6 max-w-[44ch] text-sm text-muted">
          Your streak lives in this browser.{" "}
          <a href="/signup" className="text-accent-strong underline underline-offset-4">
            Create an account
          </a>{" "}
          to keep it on your phone.
        </p>
      )}
    </>
  );
}

/* Three tiles in one row, always: a grid, not a wrapping flex row, because
   the third tile wrapping onto its own line read as two rows of unequal
   things. Each tile is a glyph, the number and its label; the glyphs are
   for a laptop and drop on a phone, where the three tiles share 360px
   (owner's call: all three carry one or none carries one). The streak
   page draws the same three, so the page the flame opens looks like the
   screen that sent you. */
export function Stats({ streak, topics, minutes }: { streak: number; topics: number; minutes: number }) {
  return (
    <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
      <Stat value={streak} label="day streak" icon={FlameIcon} />
      <Stat value={topics} label="topics" icon={TopicsIcon} />
      <Stat value={minutes} label="minutes spoken" icon={MinutesIcon} />
    </div>
  );
}

function Stat({ value, label, icon: Icon }: { value: number; label: string; icon: typeof FlameIcon }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-card px-1.5 py-3 text-center sm:px-4 sm:pt-4.5 sm:pb-4">
      <Icon size={20} className="mx-auto mb-2.5 hidden text-accent sm:block" />
      <div className="font-display text-[28px] leading-none font-semibold tracking-[-0.03em] sm:text-[40px]">{value}</div>
      <div className="mt-1.5 text-[11.5px] font-semibold text-muted sm:text-[12.5px]">{label}</div>
    </div>
  );
}
