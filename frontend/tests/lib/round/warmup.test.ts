import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Bank, Topic } from "@/lib/bank";
import { Engine, LEAD_IN, type Effect } from "@/lib/round/engine";
import { decoysFor } from "@/lib/round/pool";
import { DEFAULT_PREFS, PREFS_KEY, SPEEDS } from "@/lib/round/prefs";
import { CHAR_EM, LONG_WORD, WARMUPS_KEY, loadBests, longWordSize, readLength, readSeconds } from "@/lib/round/warmups";

/* The warm-up round: a passage read aloud off a scroller. What these pin
   is the shape that makes it cheap - no prep, no clock, nothing written to
   the server - because every one of those would pass silently if it broke:
   a warm-up that quietly posted a run would inflate the streak, and a
   streak that counts a 45-second read is the failure the naming exists to
   prevent. */

const PASSAGE =
  "Six strict speech specialists structured sixty sophisticated speaking scripts, subtly switching stressed " +
  "syllables so that steady students stumbled slightly. Such scripts seemed simple, yet several speakers " +
  "stalled, sighed, and started again. Should serious speakers surrender, or should they simply slow down.";

const SHORTER = "Which witch watched which watch, and which watch did the watching witch wish she had washed today.";

const passages: Topic[] = [
  { text: PASSAGE, genre: "tongue-twisters", style: "hard", slug: "sixty-speaking-scripts" },
  { text: SHORTER, genre: "tongue-twisters", style: "easy", slug: "which-wristwatch" },
];

/* What `/tongue-twisters` hands the round: its own genre and its own
   passages, server-rendered with the page. A warm-up no longer runs at
   home, so nothing here is fetched and there is no moment when the genre
   exists without its rows. */
const bank: Bank = {
  genres: [{ slug: "tongue-twisters", name: "Tongue twisters", icon: "mic", blurb: "", mode: "read" }],
  topics: passages,
  styles: [],
};

/* Home's bank, for the one test that checks a spoken genre still rolls. */
const home: Bank = {
  genres: [{ slug: "general", name: "General", icon: "dices", blurb: "" }],
  topics: [
    { text: "Low tide", genre: "general", style: "just-talk", slug: "low-tide" },
    { text: "Queues", genre: "general", style: "just-talk", slug: "queues" },
    { text: "Doors", genre: "general", style: "just-talk", slug: "doors" },
  ],
  styles: [
    { key: "surprise", label: "Surprise me", hint: "" },
    { key: "just-talk", label: "Just talk", hint: "" },
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

function build(seed: Record<string, string> = {}) {
  const store = memory({ [PREFS_KEY]: JSON.stringify(DEFAULT_PREFS), ...seed });
  const effects: Effect[] = [];
  /* Locked, as the feature page locks it: the genre is the page, not a
     pick, and it never becomes the genre home opens on. */
  const engine = new Engine({ bank, store, random: () => 0, lockedGenre: "tongue-twisters" });
  engine.onEffect((effect) => effects.push(effect));
  return { engine, effects, store };
}

/* The timer polls every 100ms, so advancing by exactly the reading time
   can land inside the last poll and leave the round a few milliseconds
   short. Rounded up past the next poll, which is what wall-clock time
   does on its own. */
function readToTheEnd(engine: Engine) {
  vi.advanceTimersByTime(LEAD_IN * 1000);
  vi.advanceTimersByTime(Math.ceil(engine.readSeconds) * 1000 + 200);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("a warm-up", () => {
  it("skips prep entirely, because there is nothing to think about", () => {
    const { engine } = build();
    engine.spin();
    expect(engine.phase).toBe("topic");
    expect(engine.reading).toBe(true);
    /* The same primary button as a speak round, and it does a different
       thing: the words are already on screen, so the only task left is
       keeping up with them. */
    engine.startPrep();
    expect(engine.phase).toBe("ready");
  });

  it("does not spin, because a strip of one-line prompts cannot land on a paragraph", () => {
    const { engine } = build();
    engine.spin();
    expect(engine.decoys).toEqual([]);
    expect(decoysFor(bank, { ...DEFAULT_PREFS, genre: "tongue-twisters" }, passages[0])).toEqual([]);
    /* A speak genre is untouched by that: it still rolls. */
    expect(decoysFor(home, { ...DEFAULT_PREFS, genre: "general" }, home.topics[0]).length).toBeGreaterThan(0);
  });

  it("counts down three, then scrolls for as long as the words take", () => {
    const { engine } = build();
    engine.spin();
    engine.startReading();
    expect(engine.phase).toBe("ready");
    expect(engine.leadIn).toBe(LEAD_IN);
    vi.advanceTimersByTime(LEAD_IN * 1000);
    expect(engine.phase).toBe("reading");
    /* The number the screen states before you start is this same
       arithmetic, so the two can never disagree. */
    expect(engine.readSeconds).toBeCloseTo((engine.words / 150) * 60, 5);
    vi.advanceTimersByTime(Math.ceil(engine.readSeconds) * 1000 + 200);
    expect(engine.phase).toBe("done");
  });

  it("writes nothing to the server, because it does not build the streak", () => {
    const { engine, effects } = build();
    engine.spin();
    engine.startReading();
    readToTheEnd(engine);
    expect(engine.phase).toBe("done");
    /* The one assertion that matters most here. A run row would be counted
       by the streak, and a streak that a 45-second read can extend stops
       meaning "I practised speaking". */
    expect(effects.filter((effect) => effect.type === "record")).toEqual([]);
  });

  it("keeps the fastest speed a passage was finished at, in this browser only", () => {
    const { engine, store } = build();
    engine.spin();
    engine.setSpeed(180);
    engine.startReading();
    readToTheEnd(engine);
    expect(engine.best).toBe(180);
    expect(loadBests(store)[engine.topic!.slug]).toBe(180);

    /* Slower afterwards does not lower it: it is a best, not a last. */
    engine.againFaster();
    engine.setSpeed(120);
    engine.startReading();
    readToTheEnd(engine);
    expect(engine.best).toBe(180);
  });

  it("does not count a read somebody stopped part way through", () => {
    const { engine, store } = build();
    engine.spin();
    engine.startReading();
    vi.advanceTimersByTime(LEAD_IN * 1000);
    vi.advanceTimersByTime(2000);
    engine.finishReading();
    expect(engine.phase).toBe("done");
    expect(loadBests(store)).toEqual({});
  });

  it("goes again one speed up, and stops climbing at the top", () => {
    const { engine } = build();
    engine.spin();
    engine.startReading();
    readToTheEnd(engine);
    engine.againFaster();
    expect(engine.prefs.wpm).toBe(180);
    expect(engine.phase).toBe("topic");
    /* The same passage, not another one: the loop here is repetition. */
    expect(engine.topic?.slug).toBe(passages[0].slug);

    engine.setSpeed(SPEEDS[SPEEDS.length - 1]);
    engine.startReading();
    readToTheEnd(engine);
    engine.againFaster();
    expect(engine.prefs.wpm).toBe(SPEEDS[SPEEDS.length - 1]);
  });

  it("leaves mid-read back to the passage, keeping nothing", () => {
    const { engine, effects } = build();
    engine.spin();
    engine.startReading();
    vi.advanceTimersByTime(LEAD_IN * 1000);
    engine.leaveRound();
    expect(engine.phase).toBe("topic");
    expect(effects.filter((effect) => effect.type === "record")).toEqual([]);
  });

  it("opens a passage a link names, without moving the genre home remembers", () => {
    /* The bank ships with the page, so a link to one of its passages
       resolves the moment the engine is built. And the lock is what keeps
       an hour of warm-ups from quietly becoming somebody's default topic:
       `prefs.genre` is untouched throughout. */
    const store = memory({ [PREFS_KEY]: JSON.stringify({ ...DEFAULT_PREFS, genre: "career" }) });
    const engine = new Engine({ bank, store, random: () => 0, lockedGenre: "tongue-twisters" });
    engine.arrive(new URLSearchParams("topic=which-wristwatch&wpm=220"));
    expect(engine.phase).toBe("topic");
    expect(engine.topic?.slug).toBe("which-wristwatch");
    expect(engine.prefs.wpm).toBe(220);
    expect(engine.activeGenre).toBe("tongue-twisters");
    expect(engine.prefs.genre).toBe("career");
  });

  it("ignores a genre a link names, because the page is the genre", () => {
    const { engine } = build();
    engine.arrive(new URLSearchParams("genre=general"));
    expect(engine.activeGenre).toBe("tongue-twisters");
    engine.chooseGenre("general");
    expect(engine.activeGenre).toBe("tongue-twisters");
  });

  it("hands out only the difficulty asked for, and falls back rather than empty", () => {
    const { engine } = build();
    engine.setLevel("easy");
    engine.spin();
    expect(engine.topic?.style).toBe("easy");
    engine.setLevel("hard");
    engine.spin();
    expect(engine.topic?.style).toBe("hard");
    /* A level the bank does not hold is ignored rather than accepted. */
    engine.setLevel("impossible");
    expect(engine.prefs.level).toBe("hard");
  });

  it("has no pause, because the clock and the words stop separately", () => {
    /* The words move on a transition the compositor owns; pausing the
       engine's timer stopped one and not the other, so the round finished
       after the passage had already scrolled past. */
    const { engine } = build();
    engine.spin();
    engine.startReading();
    vi.advanceTimersByTime(LEAD_IN * 1000);
    expect(engine.phase).toBe("reading");
    engine.togglePause();
    expect(engine.timer.paused).toBe(false);
    expect(engine.key("Space", { typing: false, sheetOpen: false, modifier: false })).toBe(false);
  });

  it("refuses a speed it does not offer, wherever it came from", () => {
    const { engine } = build({ [PREFS_KEY]: JSON.stringify({ genre: "tongue-twisters", wpm: 9999 }) });
    expect(engine.prefs.wpm).toBe(DEFAULT_PREFS.wpm);
    engine.setSpeed(400);
    expect(engine.prefs.wpm).toBe(DEFAULT_PREFS.wpm);
  });

  it("shrugs off a warm-up store that is not what it expects", () => {
    expect(loadBests(memory({ [WARMUPS_KEY]: "not json" }))).toEqual({});
    expect(loadBests(memory({ [WARMUPS_KEY]: JSON.stringify({ a: "fast", b: -3, c: 150 }) }))).toEqual({ c: 150 });
    expect(loadBests(null)).toEqual({});
  });
});

describe("how long a passage takes", () => {
  it("is words over speed, said the way the screen says it", () => {
    expect(readSeconds(150, 150)).toBe(60);
    expect(readSeconds(116, 150)).toBeCloseTo(46.4, 1);
    expect(readSeconds(116, 220)).toBeCloseTo(31.6, 1);
    /* A speed of nothing is nothing, rather than Infinity on the screen. */
    expect(readSeconds(116, 0)).toBe(0);
    expect(readLength(46.4)).toBe("46 seconds");
    expect(readLength(60)).toBe("a minute");
    expect(readLength(95)).toBe("1 min 35s");
  });
});

describe("a word too long for the column", () => {
  /* The bug this exists to stop: "pneumonoultramicroscopicsilicovolcano-
     coniosis" at the passage's own size is about 1500px wide in a 640px
     column, so it ran off the side of the screen. It is also the whole
     point of the passage it belongs to, so it is not broken across lines
     and not dropped from the bank. */
  const MONSTER = "pneumonoultramicroscopicsilicovolcanoconiosis";

  it("is left alone when it already fits", () => {
    expect(longWordSize("cyclist")).toBeUndefined();
    expect(longWordSize("a".repeat(LONG_WORD))).toBeUndefined();
  });

  it("takes a size that fits the column, so it stays one readable unit", () => {
    const size = longWordSize(MONSTER);
    expect(size).toBe(`min(1em, calc(100cqw / ${(MONSTER.length * CHAR_EM).toFixed(2)}))`);
    /* The column is 100cqw wide, so the word occupies at most all of it.
       Checked as arithmetic rather than as a string: what has to hold is
       that the widest character run in the bank still fits. */
    const WIDEST_CHAR_EM = 0.427;
    const size_in_cqw = 100 / (MONSTER.length * CHAR_EM);
    expect(MONSTER.length * WIDEST_CHAR_EM * size_in_cqw).toBeLessThanOrEqual(100);
  });

  it("never shrinks a word below what it needs, for every word in the real bank", () => {
    const bank = JSON.parse(
      readFileSync(path.join(process.cwd(), "..", "backend", "data", "topics", "tongue-twisters.json"), "utf8"),
    ) as { topics: { text: string }[] };
    const WIDEST_CHAR_EM = 0.427;
    for (const passage of bank.topics) {
      for (const word of passage.text.split(/\s+/)) {
        const size = longWordSize(word);
        if (!size) {
          /* Unsized words must genuinely fit at full size in the narrowest
             column the scroller draws, or the threshold is too generous. */
          expect(word.length).toBeLessThanOrEqual(LONG_WORD);
          continue;
        }
        const cqw = 100 / (word.length * CHAR_EM);
        expect(word.length * WIDEST_CHAR_EM * cqw).toBeLessThanOrEqual(100);
      }
    }
  });
});
