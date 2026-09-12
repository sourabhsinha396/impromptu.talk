import type { ReactNode } from "react";

import { PassagePhase, ReadingPhase, ReadyPhase, WarmUpDone } from "@/components/round/warmup";
import { WarmUpSettings } from "@/components/round/warmup-settings";
import { SettingsIcon } from "@/components/site/icons";
import type { Topic } from "@/lib/bank";
import type { Engine } from "@/lib/round/engine";
import { SPEEDS, type Prefs } from "@/lib/round/prefs";

/* A feature page: `/tongue-twisters` and whatever comes after it.

   It opens on the tool, not on a landing screen. The server picks the
   passage and hands it over, so the first paint is already the passage,
   its speed and its button - a landing screen that spun itself away a
   frame later would have been a flash on every single visit, and a page
   somebody has deliberately opened has already said what it is for.

   Which is also why there is no idle phase here at all. The way out of a
   passage is another passage.

   The heading stays put above the tool through every phase but the read,
   because a page needs one and because it is what tells somebody which
   feature they are in without a genre chip. The bank sits below the fold
   as plain text: it is 2,200 words of unique content and the reason this
   URL earns its place, and it costs nothing above the fold. */
export function FeatureFrame({
  feature,
  engine,
  initialTopic,
  prefs,
  sheet,
  setSheet,
  armed,
  copiedFor,
  onShare,
  children,
}: {
  feature: { slug: string; title: string; lede: string };
  /** Null until the engine is built, which is every server render. The
      passage is drawn from `initialTopic` then, so the markup the server
      sends and the markup the client hydrates are the same. */
  engine: Engine | null;
  initialTopic?: Topic;
  prefs: Prefs;
  sheet: "genre" | "settings" | null;
  setSheet: (sheet: "genre" | "settings" | null) => void;
  armed: (run: () => void) => () => void;
  copiedFor: string | null;
  onShare: (slug: string, wpm: number) => void | Promise<void>;
  children?: ReactNode;
}) {
  const topic = engine?.topic ?? initialTopic ?? null;
  const phase = engine?.phase ?? "topic";
  const words = engine?.words ?? (initialTopic ? initialTopic.text.trim().split(/\s+/).length : 0);
  const seconds = engine?.readSeconds ?? (words / prefs.wpm) * 60;

  /* Full bleed, outside the page frame: the scroller is the whole viewport
     below the header, because it is what somebody records. */
  if (phase === "reading" && topic && engine) {
    return <ReadingPhase topic={topic} seconds={engine.readSeconds} onDone={() => engine.finishReading()} />;
  }

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-headline font-semibold">{feature.title}</h1>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          aria-haspopup="dialog"
          onClick={engine ? () => setSheet("settings") : undefined}
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card2 text-muted transition-colors hover:border-accent hover:text-ink"
        >
          <SettingsIcon size={18} />
        </button>
      </div>
      <p className="mt-3 max-w-[62ch] text-[17px] text-muted">{feature.lede}</p>

      {/* The tool sits in its own screenful so it is what you land on, and
          the bank begins below it rather than competing with it. */}
      <div className="flex min-h-[62vh] w-full flex-col items-center justify-center py-8 text-center">
        {phase === "ready" && engine && <ReadyPhase digit={engine.leadIn} wpm={prefs.wpm} />}
        {phase === "done" && engine && topic && (
          <WarmUpDone
            words={engine.words}
            wpm={prefs.wpm}
            best={engine.best}
            topWpm={SPEEDS[SPEEDS.length - 1]}
            onAgain={armed(() => engine.againFaster())}
            onAnother={armed(() => engine.spin())}
            shared={copiedFor === topic.slug}
            onShare={() => void onShare(topic.slug, prefs.wpm)}
          />
        )}
        {phase === "topic" && topic && (
          <PassagePhase
            topic={topic}
            /* The bank it actually came from, not the page's name: with
               your own passages selected, a card headed "Tongue twisters"
               would be naming the wrong list. */
            genre={engine?.currentGenre?.name ?? feature.title}
            words={words}
            wpm={prefs.wpm}
            seconds={seconds}
            onStart={engine ? armed(() => engine.startReading()) : undefined}
            onSpeed={engine ? (wpm) => engine.setSpeed(wpm) : undefined}
            onSpin={engine ? armed(() => engine.spin()) : undefined}
          />
        )}
      </div>

      {/* Gone while the round runs: by then the screen belongs to the
          words, and a list under them is something to scroll past. */}
      {phase === "topic" && children}

      {engine && (
        <WarmUpSettings
          open={sheet === "settings"}
          onOpenChange={(open) => setSheet(open ? "settings" : null)}
          sources={engine.sources}
          source={engine.activeGenre === feature.slug ? "" : engine.activeGenre}
          difficulty={prefs.level}
          sound={prefs.sound}
          onSource={(slug) => engine.setSource(slug)}
          onDifficulty={(key) => engine.setLevel(key)}
          onSound={(on) => engine.setSound(on)}
        />
      )}
    </main>
  );
}
