import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { StreakPage } from "@/components/streak/streak-page";
import type { Bank } from "@/lib/bank";
import { EMPTY_HISTORY, type History } from "@/lib/practice";

const bank: Bank = {
  genres: [{ slug: "career", name: "Career & work", icon: "briefcase", blurb: "" }],
  topics: [],
  styles: [],
};

const NOW = Date.parse("2026-09-07T12:00:00Z");

function days(count: number, spoken: number[], frozen: number[] = []) {
  return Array.from({ length: count }, (_, n) => {
    const back = count - 1 - n;
    const date = new Date(NOW);
    date.setUTCDate(date.getUTCDate() - back);
    return { date: date.toISOString().slice(0, 10), count: spoken.includes(back) ? 1 : 0, frozen: frozen.includes(back) };
  });
}

const free: History = {
  streak: 3,
  longest: 3,
  topics: 7,
  minutes: 9,
  would_be: 6,
  days: 5,
  runs_kept: 25,
  calendar: days(5, [0, 1, 2]),
  recent: [{ topic_text: "Saying no at work", genre_slug: "career", at: "2026-09-07T10:00:00Z" }],
};

describe("the streak page", () => {
  it("says Day N with the tiles, the plan's window as a strip, and the recent run with its genre", () => {
    render(<StreakPage history={free} bank={bank} user={null} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Day 3.");
    expect(screen.getByText("day streak").previousSibling).toHaveTextContent("3");
    expect(screen.getByRole("heading", { name: "Last 5 days" })).toBeInTheDocument();
    const strip = screen.getAllByRole("listitem").filter((item) => item.textContent?.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Today)$/));
    expect(strip).toHaveLength(5);
    expect(strip[4]).toHaveTextContent("Today");
    expect(screen.getByText("Saying no at work")).toBeInTheDocument();
    expect(screen.getByText("Career & work")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep it going" })).toHaveAttribute("href", "/");
  });

  /* Pro lifts the cap rather than removing it; a Pro speaker past it gets
     the count and no pitch for something they already own. */
  it("says how many of the runs it shows, and pitches Pro only to someone without it", () => {
    render(<StreakPage history={free} bank={bank} user={null} now={NOW} />);
    expect(screen.getByText(/Last 1 of 7\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pro keeps them all" })).toHaveAttribute("href", "/pro");
  });

  it("tells the truth about what Pro would have held, and only when it would", () => {
    const { unmount } = render(<StreakPage history={free} bank={bank} user={null} now={NOW} />);
    expect(screen.getByText(/A missed day ended your last streak\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pro would have held it at 6." })).toBeInTheDocument();
    unmount();

    render(<StreakPage history={{ ...free, would_be: 3 }} bank={bank} user={null} now={NOW} />);
    expect(screen.queryByText(/A missed day/)).not.toBeInTheDocument();
  });

  it("draws a Pro year as the heatmap with the frozen days marked, and no pitch anywhere", () => {
    const pro: History = {
      ...free,
      streak: 41,
      days: 365,
      runs_kept: 1000,
      calendar: days(365, [0, 1, 2, 4, 5], [3]),
      topics: 1,
    };
    render(<StreakPage history={pro} bank={bank} user={{ email: "p@example.com", name: "Priya", is_superuser: false, is_pro: true }} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Last year" })).toBeInTheDocument();
    expect(screen.getByTitle(/missed, and held/)).toBeInTheDocument();
    expect(screen.getByText(/a missed day the freeze held/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pro/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Signed in as Priya\. Your streak follows you on any device\./)).toBeInTheDocument();
  });

  it("tells a stranger the streak is saved on this device, and a person signed in that it follows them", () => {
    render(<StreakPage history={free} bank={bank} user={null} now={NOW} />);
    expect(screen.getByText(/Saved on this device only\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep it with an account" })).toHaveAttribute("href", "/signup");
  });

  it("says Nothing yet with one button when there are no runs", () => {
    render(<StreakPage history={EMPTY_HISTORY} bank={bank} user={null} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nothing yet.");
    expect(screen.getByText("Finish a round. It shows up here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("day streak")).not.toBeInTheDocument();
  });

  /* A link to an empty calendar is not a thing anybody sends, and the link
     has to outlive the browser that made it. */
  it("offers a share link only to someone signed in with runs, and shows the link once it exists", () => {
    const priya = { email: "p@example.com", name: "Priya", is_superuser: false };
    const { unmount } = render(<StreakPage history={free} bank={bank} user={null} now={NOW} />);
    expect(screen.queryByText("Share")).not.toBeInTheDocument();
    unmount();

    const second = render(<StreakPage history={free} bank={bank} user={priya} now={NOW} />);
    expect(screen.getByRole("button", { name: "Create a link" })).toBeInTheDocument();
    second.unmount();

    render(<StreakPage history={{ ...free, share_token: "abc123" }} bank={bank} user={priya} now={NOW} />);
    expect(screen.getByLabelText("Your public link")).toHaveValue("http://localhost:3009/s/abc123");
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute("href", "http://localhost:3009/s/abc123");
    expect(screen.queryByRole("button", { name: "Create a link" })).not.toBeInTheDocument();

    render(<StreakPage history={EMPTY_HISTORY} bank={bank} user={priya} now={NOW} />);
    expect(screen.queryByRole("button", { name: "Create a link" })).not.toBeInTheDocument();
  });
});
