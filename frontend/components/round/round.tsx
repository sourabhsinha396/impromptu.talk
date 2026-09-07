"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { GenreSheet } from "@/components/round/genre-sheet";
import { Idle } from "@/components/round/idle";
import { DonePhase, PrepPhase, SpeakPhase, TopicPhase, type Summary } from "@/components/round/phases";
import { Reel } from "@/components/round/reel";
import { SettingsSheet } from "@/components/round/settings-sheet";
import { track } from "@/lib/analytics";
import { attach, type Report } from "@/lib/report";
import type { Bank } from "@/lib/bank";
import { Engine, type Effect } from "@/lib/round/engine";
import { Sound } from "@/lib/round/sound";
import { DEFAULT_PREFS } from "@/lib/round/prefs";
import { Listener, NOTHING } from "@/lib/round/voice";

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

/* The record's answer: the streak, topics and minutes the done screen
   shows. A failed write fails quietly and the done screen shows no
   numbers; the round already happened, and it is not the visitor's
   problem. */
/* The run's answer carries its id as well as the numbers, so the report
   can be attached to the round it describes. The done screen is handed
   only the numbers, since the tiles have no use for a row id. */
type Recorded = Summary & { id: number };

async function record(payload: Extract<Effect, { type: "record" }>["payload"]): Promise<Recorded | null> {
  try {
    const response = await fetch("/api/v1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok ? ((await response.json()) as Recorded) : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

export function Round({
  bank,
  signedIn,
  isPro = false,
  ownCap,
}: {
  bank: Bank;
  signedIn: boolean;
  isPro?: boolean;
  /** How many genres an account may hold, for the picker to say once. */
  ownCap?: number;
}) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  /* Three states, not two: null is waiting on the transcriber, "off" is a
     round with no microphone behind it, and neither should draw the same
     thing. Without the third the placeholder would pulse forever for
     everybody who declined the prompt. */
  const [report, setReport] = useState<Report | "off" | null>(null);
  /* The run's row, once written, so the done screen can link to the
     round's own page. */
  const [runId, setRunId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"genre" | "settings" | null>(null);
  /* One listener for the life of the page. In a ref because nothing
     renders differently for it existing: it is a microphone, not state. */
  const listener = useRef<Listener | null>(null);
  if (listener.current === null && typeof window !== "undefined") listener.current = new Listener();

  useEffect(() => {
    const made = new Engine({
      bank,
      store: safeStorage(),
      reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    const audio = new Sound(() => made.prefs.sound);
    const off = made.onEffect((effect) => {
      if (effect.type === "sound") audio.play(effect);
      else if (effect.type === "track") track(effect.name, effect.props);
      else if (effect.type === "record") {
        setSummary(null);
        setReport(null);
        setRunId(null);
        /* Stopped before the run is written, so the recording is closed
           while the POST is in flight rather than after it. */
        const heard = listener.current?.stop() ?? Promise.resolve(NOTHING);
        void record(effect.payload).then(async (answer) => {
          setSummary(answer);
          if (!answer) return;
          setRunId(answer.id);
          const listened = await heard;
          /* A refused or missing microphone has nothing to report, and the
             round trip could only ever answer "we could not hear you". */
          if (!listened.segments.length && !listened.audio) return setReport("off");
          setReport((await attach(answer.id, listened)) ?? "off");
        });
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

  /* The microphone opens when the topic lands and the timeline starts when
     the speaking does, and **only** once somebody has switched it on.

     Calling for it under any other state is what put Chrome's own prompt
     over the topic, unasked, before anybody knew what it was for. An
     unexplained prompt is refused by reflex and "Never allow" is permanent
     for the site: nothing in this code can ask again, and the person would
     have to find their browser's site settings to undo it. So the rule is
     that the browser's prompt may only ever appear inside a press on a
     control of ours that said it would.

     The topic lands again on every respin and on every reset back from
     prep or speak, so `start` runs more than once a round. It is
     idempotent, and the one open microphone is reused. */
  const phase = engine?.phase;
  const mic = engine?.prefs.mic ?? "ask";
  useEffect(() => {
    const ears = listener.current;
    if (!ears || mic !== "on") return;
    if (phase === "topic") void ears.start();
    else if (phase === "speak") ears.mark();
    else if (phase === "idle") void ears.stop();
  }, [phase, mic]);

  /* Pausing stops the clock, so it stops the microphone with it. Camera
     mode lets somebody pause mid-round with the space bar, and a
     microphone that kept listening through it handed back a hole the
     speaker never left. */
  const paused = engine?.timer.paused ?? false;
  useEffect(() => {
    const ears = listener.current;
    if (!ears || phase !== "speak") return;
    if (paused) ears.pause();
    else ears.resume();
  }, [paused, phase]);

  /* Leaving the page with the microphone open is the one thing here that
     outlives the round. */
  useEffect(() => () => void listener.current?.stop(), []);

  /* The only call for the microphone that is not gated on the pref, and it
     is inside a press. Opened and closed again at once, because all this
     wants is the permission: the round it was offered on is already over,
     and the report starts with the next one.

     A refusal writes "off" rather than leaving it "on" and failing
     silently every round after. There is no asking again from here, so the
     settings sheet is where that state is explained. */
  const turnOnMic = useCallback(async () => {
    const ears = listener.current;
    if (!ears) return;
    const allowed = await ears.start();
    await ears.stop();
    engine?.setMic(allowed ? "on" : "off");
  }, [engine]);

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
  const prefs = engine?.prefs ?? { ...DEFAULT_PREFS, genre: genre.slug };

  if (!engine || engine.phase === "idle") {
    return (
      <>
        <Idle
          genre={genre}
          speakSeconds={prefs.speak}
          onSpin={engine ? armed(() => engine.spin()) : undefined}
          offerMic={engine?.prefs.mic === "ask"}
          onMicYes={() => void turnOnMic()}
          onMicNo={() => engine?.setMic("off")}
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
              ownCap={ownCap}
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
              onMic={(on) => (on ? void turnOnMic() : engine.setMic("off"))}
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
          report={report}
          runId={runId}
          spokenSeconds={engine.spokeFor}
          signedIn={signedIn}
          onAgain={armed(() => engine.spin())}
          onSame={() => engine.sameTopic()}
        />
      )}
    </main>
  );
}
