import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SharedPage } from "@/components/streak/shared-page";
import type { Shared, SharedProgress } from "@/lib/practice";

function days(count: number, spoken: number[]) {
  return Array.from({ length: count }, (_, n) => {
    const back = count - 1 - n;
    const date = new Date(Date.UTC(2026, 8, 7));
    date.setUTCDate(date.getUTCDate() - back);
    return { date: date.toISOString().slice(0, 10), count: spoken.includes(back) ? 1 : 0, frozen: false };
  });
}

/* Two rounds five weeks apart: the first mostly holes, the latest mostly
   voice. Enough for the waves to differ and for every line to have moved. */
const progress: SharedProgress = {
  enough: true,
  points: [
    { at: "2026-08-03T09:00:00Z", stall: 3.4, gap: 6.1, fillers: 7, silence: 28.3, restarts: 0 },
    { at: "2026-09-07T09:00:00Z", stall: 1, gap: 2.2, fillers: 3, silence: 10.3, restarts: 2 },
  ],
  first: { at: "2026-08-03T09:00:00Z", seconds: 60, segments: [[6, 14], [26, 33], [48, 55]] },
  latest: { at: "2026-09-07T09:00:00Z", seconds: 60, segments: [[1, 27], [29, 58]] },
};

const priya: Shared = {
  name: "Priya",
  streak: 41,
  topics: 63,
  minutes: 88,
  days: 56,
  calendar: days(56, [0, 1, 2]),
  recent: [
    { text: "Low tide", slug: "low-tide" },
    { text: "Saying no at work", slug: "saying-no-at-work" },
  ],
  progress,
};

describe("the shared page", () => {
  /* The only page a stranger can open about a named person, so what
     matters is what it says and what it does not. */
  it("names the person and their numbers, eight weeks, and the bank topics as links into a round", () => {
    render(<SharedPage shared={priya} />);
    expect(screen.getByText("Priya on yapholic.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Day 41.");
    expect(screen.getByText("day streak").previousSibling).toHaveTextContent("41");
    expect(screen.getByRole("heading", { name: "Last eight weeks" })).toBeInTheDocument();
    expect(screen.getAllByTitle(/^2026-/)).toHaveLength(56);
    expect(screen.getByRole("link", { name: "Low tide" })).toHaveAttribute("href", "/?topic=low-tide");
    expect(screen.getByRole("link", { name: "Try one yourself" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Pro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  /* The charts are the reason anybody sends the link, and the reason to
     be careful with it: a point is five numbers and a minute is where
     there was a voice, so the drawings say a person got better without
     saying a word that person said. */
  it("draws the two minutes and the three lines over the same eight weeks", () => {
    render(<SharedPage shared={priya} />);
    expect(screen.getByRole("heading", { name: "Getting better" })).toBeInTheDocument();
    expect(screen.getByText("The first minute, and the latest")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "First minute" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Latest minute" })).toBeInTheDocument();
    expect(screen.getByText(/over the same eight weeks/)).toBeInTheDocument();
    for (const line of ["Silence in the minute", "Restarts a round", "Time to start"]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText("was 28.3s ·", { exact: false })).toBeInTheDocument();
  });

  it("draws nothing about progress until there are two rounds to compare", () => {
    const alone = { ...priya, progress: { enough: false, points: [], first: null, latest: null } };
    render(<SharedPage shared={alone} />);
    expect(screen.queryByRole("heading", { name: "Getting better" })).not.toBeInTheDocument();
  });

  it("calls a person with no name a speaker and a person with no streak just getting started", () => {
    render(<SharedPage shared={{ ...priya, name: "", streak: 0, recent: [] }} />);
    expect(screen.getByText("A speaker on yapholic.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Just getting started.");
    expect(screen.queryByRole("heading", { name: "Recently practised" })).not.toBeInTheDocument();
  });
});
