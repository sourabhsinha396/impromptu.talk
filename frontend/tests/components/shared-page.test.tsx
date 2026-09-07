import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SharedPage } from "@/components/streak/shared-page";
import type { Shared } from "@/lib/practice";

function days(count: number, spoken: number[]) {
  return Array.from({ length: count }, (_, n) => {
    const back = count - 1 - n;
    const date = new Date(Date.UTC(2026, 8, 7));
    date.setUTCDate(date.getUTCDate() - back);
    return { date: date.toISOString().slice(0, 10), count: spoken.includes(back) ? 1 : 0, frozen: false };
  });
}

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
};

describe("the shared page", () => {
  /* The only page a stranger can open about a named person, so what
     matters is what it says and what it does not. */
  it("names the person and their numbers, eight weeks, and the bank topics as links into a round", () => {
    render(<SharedPage shared={priya} />);
    expect(screen.getByText("Priya on impromptu.talk")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Day 41.");
    expect(screen.getByText("day streak").previousSibling).toHaveTextContent("41");
    expect(screen.getByRole("heading", { name: "Last eight weeks" })).toBeInTheDocument();
    expect(screen.getAllByTitle(/^2026-/)).toHaveLength(56);
    expect(screen.getByRole("link", { name: "Low tide" })).toHaveAttribute("href", "/?topic=low-tide");
    expect(screen.getByRole("link", { name: "Try one yourself" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Pro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  it("calls a person with no name a speaker and a person with no streak just getting started", () => {
    render(<SharedPage shared={{ ...priya, name: "", streak: 0, recent: [] }} />);
    expect(screen.getByText("A speaker on impromptu.talk")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Just getting started.");
    expect(screen.queryByRole("heading", { name: "Recently practised" })).not.toBeInTheDocument();
  });
});
