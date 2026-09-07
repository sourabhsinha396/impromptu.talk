import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { RoundDetail } from "@/components/streak/round-detail";
import type { Report } from "@/lib/report";

/* The round's own page draws with Recharts, which measures its container;
   jsdom has no ResizeObserver, so one that does nothing stands in. What is
   pinned here is what the page says and shows, not how the arcs are
   drawn: the read-back is open, the donut counts every word said, a free
   round is told nothing about fillers, and the caption names the shape. */
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const PRO: Report = {
  heard: true,
  speaking_seconds: 50,
  opening_stall: 1,
  pauses: [{ at: 20, seconds: 1.1, awkward: false }],
  longest_pause: 1.1,
  awkward_pauses: 0,
  speaking_ratio: 0.9,
  trail_off: 1,
  words: 11,
  pace: 143,
  fillers: 2,
  filler_rate: 2.2,
  crutch_words: [],
  filler_words: ["um", "uh"],
  fillers_at_transitions: 1,
  transcript: "A good pen is essential. Um, I said, uh, I said pen fight.",
  said: [
    { kind: "word", text: "A", seconds: 0.1, awkward: false, at: 1 },
    { kind: "word", text: "good", seconds: 0.2, awkward: false, at: 1.2 },
    { kind: "word", text: "pen", seconds: 0.2, awkward: false, at: 1.5 },
    { kind: "word", text: "is", seconds: 0.1, awkward: false, at: 1.8 },
    { kind: "word", text: "essential.", seconds: 0.4, awkward: false, at: 2 },
    { kind: "filler", text: "Um,", seconds: 0.3, awkward: false, at: 2.6 },
    { kind: "word", text: "I", seconds: 0.1, awkward: false, at: 3 },
    { kind: "word", text: "said,", seconds: 0.2, awkward: false, at: 3.2 },
    { kind: "filler", text: "uh,", seconds: 0.3, awkward: false, at: 3.5 },
    { kind: "word", text: "I", seconds: 0.1, awkward: false, at: 3.9 },
    { kind: "word", text: "said", seconds: 0.2, awkward: false, at: 4.1 },
    { kind: "word", text: "pen", seconds: 0.2, awkward: false, at: 4.4 },
    { kind: "word", text: "fight.", seconds: 0.3, awkward: false, at: 4.7 },
  ],
  topic: "Argue for owning one good pen",
  at: "2026-09-07T12:00:00Z",
  genre_slug: "general",
  seconds_left: 300,
  pace_curve: [
    { start: 0, end: 10, wpm: 156 },
    { start: 10, end: 20, wpm: 120 },
    { start: 20, end: 30, wpm: 210 },
  ],
  filler_times: [
    { word: "um", at: 2.6 },
    { word: "uh", at: 3.5 },
  ],
  filler_counts: [
    { word: "uh", count: 1 },
    { word: "um", count: 1 },
  ],
  leaned_on: [],
  restarts: [{ quote: "I said, uh, I said", at: 3 }],
  repeats: [],
  sentences: [
    { text: "A good pen is essential and so on for fifty-six words.", words: 56, role: "", at: null, end: null },
    { text: "Um, I said, uh, I said pen fight.", words: 6, role: "", at: null, end: null },
  ],
  ended_clean: true,
  usual: { pace: 148, stall: 3.1, gap: 2.4, fillers: 3.2, sentence: 24, rounds: 12 },
  case: null,
};

describe("RoundDetail", () => {
  it("opens the read-back and counts every word said, fillers included, in the donut", () => {
    render(<RoundDetail report={PRO} length={58} pro />);
    // No click: the page is the record, so the words are on it, with the
    // fillers marked where they were said.
    expect(screen.getByText("Um,")).toBeInTheDocument();
    expect(screen.getByText("of 13 words")).toBeInTheDocument();
    expect(screen.getByText("2 of 13 words · 1 um beside a gap")).toBeInTheDocument();
  });

  it("says how many measures landed and which is furthest out", () => {
    render(<RoundDetail report={PRO} length={58} pro />);
    expect(screen.getByText("4 of 5 in the comfortable range · furthest out: longest sentence")).toBeInTheDocument();
    expect(screen.getByText("last word, on a full stop")).toBeInTheDocument();
  });

  it("tells a free round about its pace and its restart and nothing about fillers", () => {
    const free: Report = {
      ...PRO,
      fillers: null,
      filler_rate: null,
      filler_words: [],
      fillers_at_transitions: null,
      filler_times: [],
      filler_counts: [],
      transcript: "A good pen is essential. I said, I said pen fight.",
      said: PRO.said.filter((part) => part.kind !== "filler"),
      restarts: [{ quote: "I said, I said", at: 3 }],
      usual: null,
    };
    render(<RoundDetail report={free} length={58} pro={false} />);
    expect(screen.getByText("Pace through the minute")).toBeInTheDocument();
    expect(screen.getByText(/Pro counts them/)).toBeInTheDocument();
    expect(screen.queryByText("Fillers")).not.toBeInTheDocument();
    expect(screen.getByText("Restart")).toBeInTheDocument();
    expect(screen.getByText("of 11 words")).toBeInTheDocument();
  });
});
