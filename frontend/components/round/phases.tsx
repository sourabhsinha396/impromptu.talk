import { Ring } from "@/components/round/ring";
import { Button } from "@/components/site/button";
import { FlameIcon, GenreIcon, PauseIcon, PlayIcon, StyleIcon } from "@/components/site/icons";
import { LogoMark } from "@/components/site/logo";
import type { Topic } from "@/lib/bank";
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
        <Button size="xl" onClick={onThink}>
          {thinkLabel(prepSeconds)}
        </Button>
        {prepSeconds > 0 && (
          <Button variant="ghost" onClick={onSpeakNow}>
            Speak now
          </Button>
        )}
        <Button variant="ghost" onClick={onSpin} aria-label="Spin for another topic">
          <LogoMark className="size-[18px]" />
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
    <Button variant="ghost" onClick={onPause} aria-pressed={paused}>
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
        <Button size="xl" onClick={onSpeakNow}>
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
        <Button size="xl" onClick={onDone}>
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
  signedIn,
  onAgain,
  onSame,
}: {
  summary: Summary | null;
  signedIn: boolean;
  onAgain: () => void;
  onSame: () => void;
}) {
  const headline = summary && summary.streak > 1 ? `Day ${summary.streak}.` : "Nice.";
  return (
    <>
      <p className="font-display text-headline font-semibold">{headline}</p>
      {summary && (
        <div className="mt-8 mb-9 flex flex-wrap justify-center gap-3.5">
          <Stat value={summary.streak} label="day streak" flame />
          <Stat value={summary.topics} label="topics" />
          <Stat value={summary.minutes} label="minutes spoken" />
        </div>
      )}
      <div className={`${ROW} ${summary ? "" : "mt-8"}`}>
        <Button size="xl" onClick={onAgain}>
          <LogoMark className="size-[18px]" />
          Spin again
        </Button>
        <Button variant="ghost" onClick={onSame}>
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

function Stat({ value, label, flame = false }: { value: number; label: string; flame?: boolean }) {
  return (
    <div className="min-w-[150px] rounded-card border border-line bg-card px-5 py-4.5 text-center">
      <div className="inline-flex items-center gap-1.5 font-display text-[44px] leading-none font-semibold tracking-[-0.03em]">
        {flame && <FlameIcon size={30} className="text-accent" />}
        {value}
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-muted">{label}</div>
    </div>
  );
}
