"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { GenreSheet } from "@/components/round/genre-sheet";
import { Idle } from "@/components/round/idle";
import { DonePhase, PrepPhase, SpeakPhase, TopicPhase, type Summary } from "@/components/round/phases";
import { Reel } from "@/components/round/reel";
import { SettingsSheet } from "@/components/round/settings-sheet";
import type { Bank } from "@/lib/bank";
import { Engine, type Effect } from "@/lib/round/engine";
import { Sound } from "@/lib/round/sound";

/* The round on the page. The engine owns every rule; this component makes
   one, subscribes to it, renders whatever phase it is in, and hands back
   presses. Sound, the write to the server and analytics hang off the
   effects the engine emits.

   The engine is made after mount, not during render: it reads the
   visitor's prefs from storage, and the server cannot know those, so the
   first paint is the idle screen with the defaults and the chip and the
   headline correct themselves a frame later. That is the one flash the
   page allows, and it is smaller than a hydration mismatch. */

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* The record's answer, when the sessions card lands; until then the call
   fails quietly and the done screen shows no numbers. The round already
   happened; a failed write is not the visitor's problem. */
async function record(payload: Extract<Effect, { type: "record" }>["payload"]): Promise<Summary | null> {
  try {
    const response = await fetch("/api/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok ? ((await response.json()) as Summary) : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

export function Round({ bank, signedIn, isPro = false }: { bank: Bank; signedIn: boolean; isPro?: boolean }) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sheet, setSheet] = useState<"genre" | "settings" | null>(null);

  useEffect(() => {
    const made = new Engine({
      bank,
      store: safeStorage(),
      reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    const audio = new Sound(() => made.prefs.sound);
    const off = made.onEffect((effect) => {
      if (effect.type === "sound") audio.play(effect);
      else if (effect.type === "record") {
        setSummary(null);
        void record(effect.payload).then(setSummary);
      }
    });
    if (made.arrive(new URLSearchParams(window.location.search))) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setEngine(made);
    setSound(audio);
    return () => {
      off();
      made.timer.stop();
    };
  }, [bank]);

  useSyncExternalStore(engine?.subscribe ?? noop, engine?.snapshot ?? (() => 0), () => 0);

  /* Camera mode: the chrome hides while thinking and speaking. */
  const filming = engine?.filming ?? false;
  useEffect(() => {
    document.body.classList.toggle("filming", filming);
    return () => document.body.classList.remove("filming");
  }, [filming]);

  useEffect(() => {
    if (!engine) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      const handled = engine.key(event.code === "Escape" || event.key === "Escape" ? "Escape" : event.code, {
        typing,
        sheetOpen: document.querySelector("[data-sheet-open]") !== null,
        modifier: event.metaKey || event.ctrlKey || event.altKey,
      });
      if (handled) {
        sound?.arm();
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [engine, sound]);

  /* Every press that starts something arms the audio first, because a
     context can only be started inside a gesture. */
  const armed = useCallback(
    (action: () => void) => () => {
      sound?.arm();
      action();
    },
    [sound],
  );
  const settle = useCallback(() => engine?.settle(), [engine]);

  const genre = engine?.currentGenre ?? bank.genres[0] ?? { slug: "general", name: "General", icon: "dices", blurb: "" };
  const prefs = engine?.prefs ?? { genre: genre.slug, prep: 60, speak: 60, style: "surprise", sound: true };

  if (!engine || engine.phase === "idle") {
    return (
      <>
        <Idle
          genre={genre}
          speakSeconds={prefs.speak}
          onSpin={engine ? armed(() => engine.spin()) : undefined}
          onGenre={engine ? () => setSheet("genre") : undefined}
          onSettings={engine ? () => setSheet("settings") : undefined}
        />
        {engine && (
          <>
            <GenreSheet
              open={sheet === "genre"}
              onOpenChange={(open) => setSheet(open ? "genre" : null)}
              bank={bank}
              current={prefs.genre}
              isPro={isPro}
              onChoose={(slug) => {
                engine.chooseGenre(slug);
                setSheet(null);
              }}
            />
            <SettingsSheet
              open={sheet === "settings"}
              onOpenChange={(open) => setSheet(open ? "settings" : null)}
              bank={bank}
              prefs={prefs}
              onPreview={(which, seconds) => engine.previewLength(which, seconds)}
              onLength={(which, seconds) => engine.setLength(which, seconds)}
              onStyle={(key) => engine.chooseStyle(key)}
              onSound={(on) => engine.setSound(on)}
            />
          </>
        )}
      </>
    );
  }

  const clock = {
    fraction: engine.timer.fraction,
    text: engine.timer.text,
    ending: engine.timer.ending,
    paused: engine.timer.paused,
  };
  const topic = engine.topic;
  const styleLabel = bank.styles.find((style) => style.key === topic?.style)?.label ?? topic?.style ?? "";

  return (
    <main className="flex min-h-[calc(100dvh-var(--header-h))] flex-1 flex-col items-center justify-center px-[clamp(16px,4vw,32px)] py-6 text-center">
      <h1 className="sr-only">Impromptu speaking practice, a free random topic generator and timer</h1>
      {engine.phase === "spin" && topic && (
        <>
          <Reel decoys={engine.decoys} winner={topic.text} onSettle={settle} />
          {/* The footprint of the topic phase's button row, so the settle
              does not shove the page. */}
          <div className="invisible mt-11 h-[54px]" aria-hidden />
        </>
      )}
      {engine.phase === "topic" && topic && (
        <TopicPhase
          topic={topic}
          genre={genre}
          styleLabel={styleLabel}
          prepSeconds={prefs.prep}
          onThink={armed(() => engine.startPrep())}
          onSpeakNow={armed(() => engine.startSpeak())}
          onSpin={armed(() => engine.spin())}
          onReset={() => engine.resetToIdle()}
        />
      )}
      {engine.phase === "prep" && topic && (
        <PrepPhase
          topic={topic}
          clock={clock}
          notes={engine.notes}
          onNote={(index, text) => engine.setNote(index, text)}
          onPause={() => engine.togglePause()}
          onSpeakNow={armed(() => engine.startSpeak())}
          onReset={() => engine.leaveRound()}
        />
      )}
      {engine.phase === "speak" && topic && (
        <SpeakPhase
          topic={topic}
          clock={clock}
          notes={engine.notes}
          onPause={() => engine.togglePause()}
          onDone={() => engine.done()}
          onReset={() => engine.leaveRound()}
        />
      )}
      {engine.phase === "done" && (
        <DonePhase
          summary={summary}
          signedIn={signedIn}
          onAgain={armed(() => engine.spin())}
          onSame={() => engine.sameTopic()}
        />
      )}
    </main>
  );
}
