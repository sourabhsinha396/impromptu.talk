import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Bank } from "@/lib/bank";
import { Engine, type Effect } from "@/lib/round/engine";
import { PREFS_KEY, STAGE_KEY, loadPrefs } from "@/lib/round/prefs";

function topic(genre: string, text: string, style = "just-talk") {
  return { text, genre, style, slug: text.toLowerCase().replace(/\s+/g, "-") };
}

const bank: Bank = {
  genres: [
    { slug: "general", name: "General", icon: "dices", blurb: "" },
    { slug: "career", name: "Career", icon: "briefcase", blurb: "" },
  ],
  topics: [
    topic("general", "Low tide"),
    topic("general", "Queues"),
    topic("general", "Tipping should end", "hot-take"),
    topic("career", "Your first job"),
    topic("career", "Job titles are meaningless", "hot-take"),
  ],
  styles: [
    { key: "surprise", label: "Surprise me", hint: "" },
    { key: "just-talk", label: "Just talk", hint: "" },
    { key: "hot-take", label: "Hot take", hint: "" },
  ],
};

function memory(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

function build(seed: Record<string, string> = {}, options: Partial<ConstructorParameters<typeof Engine>[0]> = {}) {
  const store = memory(seed);
  const effects: Effect[] = [];
  const engine = new Engine({ bank, store, random: () => 0, tzOffset: () => 330, ...options });
  engine.onEffect((effect) => effects.push(effect));
  return { engine, store, effects };
}

const sounds = (effects: Effect[]) => effects.filter((e) => e.type === "sound").map((e) => e.sound);
const tracked = (effects: Effect[]) => effects.filter((e) => e.type === "track").map((e) => e.name);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the round", () => {
  it("runs spin, topic, think, speak, done, with the sounds and the record in the right places", () => {
    const { engine, effects } = build({}, { reduceMotion: false });
    engine.spin();
    expect(engine.phase).toBe("spin");
    expect(engine.decoys).toHaveLength(11);
    expect(sounds(effects)).toEqual(["spin"]);

    engine.settle();
    expect(engine.phase).toBe("topic");
    expect(engine.topic?.text).toBe("Low tide");

    engine.startPrep();
    expect(engine.phase).toBe("prep");
    expect(engine.filming).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(sounds(effects).filter((s) => s === "tick")).toHaveLength(3);

    vi.advanceTimersByTime(57_000);
    expect(engine.phase).toBe("speak");
    expect(sounds(effects)).toContain("chime");
    const ticksWhileThinking = sounds(effects).filter((s) => s === "tick").length;
    expect(ticksWhileThinking).toBe(59);

    /* No metronome under your own voice: it would land in the recording. */
    vi.advanceTimersByTime(60_000);
    expect(engine.phase).toBe("done");
    expect(engine.spokeFor).toBe(60);
    expect(sounds(effects).filter((s) => s === "tick")).toHaveLength(ticksWhileThinking);
    const record = effects.find((e) => e.type === "record");
    expect(record?.type === "record" && record.payload).toEqual({
      topic_text: "Low tide",
      genre_slug: "general",
      prep_seconds: 60,
      speak_seconds: 60,
      spoken_seconds: 60,
      tz_offset: 330,
    });
    expect(tracked(effects)).toEqual(["spin_started", "topic_shown", "prep_started", "speak_started", "round_finished"]);
  });

  it("records what was actually spoken when Done comes early, and nothing when Reset leaves", () => {
    const { engine, effects } = build({}, { reduceMotion: true });
    engine.spin();
    engine.startPrep();
    engine.startSpeak();
    vi.advanceTimersByTime(23_400);
    engine.done();
    expect(engine.phase).toBe("done");
    const record = effects.find((e) => e.type === "record");
    expect(record?.type === "record" && record.payload.spoken_seconds).toBe(23);

    const again = build({}, { reduceMotion: true });
    again.engine.spin();
    again.engine.startSpeak();
    again.engine.setNote(0, "kept");
    vi.advanceTimersByTime(5_000);
    again.engine.leaveRound();
    expect(again.engine.phase).toBe("topic");
    expect(again.engine.topic?.text).toBe("Low tide");
    expect(again.engine.notes[0]).toBe("kept");
    expect(again.effects.some((e) => e.type === "record")).toBe(false);
    expect(again.engine.timer.running).toBe(false);
  });

  it("drops a refused topic on Reset from the topic, so the next spin cannot land on it", () => {
    const { engine } = build({}, { reduceMotion: true });
    engine.spin();
    const refused = engine.topic?.text;
    engine.resetToIdle();
    expect(engine.phase).toBe("idle");
    expect(engine.topic).toBeNull();
    engine.spin();
    expect(engine.topic?.text).not.toBe(refused);
  });

  it("consumes a staged topic on the next spin only, and moves the genre with it", () => {
    const { engine, store } = build({ [STAGE_KEY]: JSON.stringify({ g: "career", t: "Your first job" }) }, { reduceMotion: true });
    expect(engine.arrive(new URLSearchParams(""))).toBe(false);
    expect(engine.prefs.genre).toBe("career");
    engine.spin();
    expect(engine.topic?.text).toBe("Your first job");
    expect(store.map.has(STAGE_KEY)).toBe(false);
    engine.resetToIdle();
    engine.spin();
    expect(engine.topic?.text).not.toBe("Your first job");
  });

  it("opens a permalink on its topic without a spin, remembers a genre link, and asks for the address bar to be cleaned", () => {
    const { engine, store } = build({}, { reduceMotion: true });
    expect(engine.arrive(new URLSearchParams("?topic=job-titles-are-meaningless"))).toBe(true);
    expect(engine.phase).toBe("topic");
    expect(engine.topic?.text).toBe("Job titles are meaningless");
    expect(engine.prefs.genre).toBe("career");

    const other = build({}, { reduceMotion: true });
    expect(other.engine.arrive(new URLSearchParams("?genre=career"))).toBe(true);
    expect(other.engine.phase).toBe("idle");
    expect(loadPrefs(other.store).genre).toBe("career");
    expect(other.engine.arrive(new URLSearchParams("?genre=nope"))).toBe(true);
    expect(other.engine.prefs.genre).toBe("career");
    expect(store.map.has(PREFS_KEY)).toBe(false);
  });

  it("reads v0's prefs, format key included, and drops a coined style when the genre changes", () => {
    const { engine, store } = build({
      [PREFS_KEY]: JSON.stringify({ genre: "career", prep: 120, speak: 5000, format: "hot-take", sound: 0 }),
    });
    expect(engine.prefs).toEqual({ genre: "career", prep: 120, speak: 600, style: "hot-take", sound: false });
    engine.chooseGenre("general");
    expect(engine.prefs.style).toBe("hot-take");
    engine.chooseStyle("IELTS style");
    engine.chooseGenre("career");
    expect(engine.prefs.style).toBe("surprise");
    const written = JSON.parse(store.map.get(PREFS_KEY)!);
    expect(written).toMatchObject({ genre: "career", style: "surprise" });
    expect("format" in written).toBe(false);
  });

  it("maps the keys: space starts and pauses, N spins, Escape resets, sheets and typing win", () => {
    const { engine } = build({}, { reduceMotion: true });
    const free = { typing: false, sheetOpen: false, modifier: false };
    expect(engine.key("Space", free)).toBe(true);
    expect(engine.phase).toBe("topic");
    expect(engine.key("KeyN", free)).toBe(true);
    expect(engine.phase).toBe("topic");
    expect(engine.key("Space", free)).toBe(true);
    expect(engine.phase).toBe("prep");
    expect(engine.key("KeyN", free)).toBe(false);
    expect(engine.key("Space", free)).toBe(true);
    expect(engine.timer.paused).toBe(true);
    expect(engine.key("Escape", { ...free, typing: true })).toBe(true);
    expect(engine.phase).toBe("topic");
    expect(engine.key("Escape", { ...free, sheetOpen: true })).toBe(false);
    expect(engine.key("Escape", free)).toBe(true);
    expect(engine.phase).toBe("idle");
    expect(engine.key("Space", { ...free, modifier: true })).toBe(false);
  });

  it("goes straight to talking when there is no thinking time", () => {
    const { engine, effects } = build({}, { reduceMotion: true });
    engine.setLength("prep", 0);
    engine.spin();
    engine.startPrep();
    expect(engine.phase).toBe("speak");
    expect(tracked(effects)).not.toContain("prep_started");
  });
});
