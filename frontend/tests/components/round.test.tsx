import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lengthWords, thinkLabel } from "@/components/round/phases";
import { Round } from "@/components/round/round";
import type { Bank } from "@/lib/bank";

const tracked = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ track: tracked }));

function topic(genre: string, text: string, style = "just-talk") {
  return { text, genre, style, slug: text.toLowerCase().replace(/\s+/g, "-") };
}

const bank: Bank = {
  genres: [{ slug: "general", name: "General", icon: "dices", blurb: "" }],
  topics: [topic("general", "Low tide"), topic("general", "Queues"), topic("general", "Tipping should end", "hot-take")],
  styles: [
    { key: "surprise", label: "Surprise me", hint: "" },
    { key: "just-talk", label: "Just talk", hint: "" },
    { key: "hot-take", label: "Hot take", hint: "" },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  /* Reduced motion skips the reel, which is the engine's own path and is
     tested there; this test is about the page around it. */
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.classList.remove("filming");
});

describe("the round on the page", () => {
  it("goes idle, topic, think, speak, done on presses, hides the chrome mid-round, and records the run", async () => {
    const sent = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ streak: 3, topics: 12, minutes: 9 }), { headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", sent);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Round bank={bank} signedIn={false} />);

    await user.click(await screen.findByRole("button", { name: "Spin" }));
    const topicText = await screen.findByText(/Low tide|Queues|Tipping should end/);
    expect(topicText).toBeInTheDocument();
    expect(document.body.classList.contains("filming")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Think for a minute" }));
    expect(screen.getByRole("timer")).toHaveTextContent("1:00");
    expect(document.body.classList.contains("filming")).toBe(true);
    await user.type(screen.getByLabelText("Note 1"), "keywords");

    await user.click(screen.getByRole("button", { name: "Speak now" }));
    expect(screen.getByText("keywords")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByRole("timer")).toHaveTextContent("0:48");

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(document.body.classList.contains("filming")).toBe(false);
    expect(sent).toHaveBeenCalledOnce();
    const body = JSON.parse((sent.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ genre_slug: "general", prep_seconds: 60, speak_seconds: 60, spoken_seconds: 12 });
    expect(body.notes).toBeUndefined();
    expect(await screen.findByText("Day 3.")).toBeInTheDocument();
    expect(screen.getByText("day streak").previousSibling).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /Spin again/ })).toBeInTheDocument();
    expect(screen.getByText(/Create an account/)).toBeInTheDocument();
  });

  /* The mask in the PostHog config is only a promise; this is the markup
     that keeps it. A note textarea without the class is filmed while it is
     typed, and a chip without it is filmed a minute later where no input
     rule can see it, and nothing else on the site would say so. */
  it("marks the prep notes and the speak chips for the replay mask, and tracks nothing they say", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Round bank={bank} signedIn={false} />);

    await user.click(await screen.findByRole("button", { name: "Spin" }));
    await screen.findByText(/Low tide|Queues|Tipping should end/);
    await user.click(screen.getByRole("button", { name: "Think for a minute" }));
    const notes = screen.getAllByRole("textbox");
    expect(notes).toHaveLength(3);
    for (const note of notes) expect(note).toHaveClass("ph-no-capture");
    await user.type(notes[0], "secret words");

    await user.click(screen.getByRole("button", { name: "Speak now" }));
    expect(screen.getByText("secret words")).toHaveClass("ph-no-capture");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(tracked.mock.calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(tracked.mock.calls)).not.toContain("secret");
    expect(tracked).toHaveBeenCalledWith("round_finished", expect.objectContaining({ notes_written: 1 }));
  });

  /* A round with no microphone behind it draws nothing about one. The
     meter and the check are the only two places the product ever mentions
     the microphone mid-round, and somebody who said "not now" should never
     meet either of them. */
  it("draws no meter and no microphone line for a round that is not listening", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Round bank={bank} signedIn={false} />);

    await user.click(await screen.findByRole("button", { name: "Spin" }));
    await screen.findByText(/Low tide|Queues|Tipping should end/);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText(/We can't hear your microphone/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Speak now" }));
    expect(screen.queryByRole("img", { name: /microphone/i })).not.toBeInTheDocument();
  });

  /* The half of the bug that was silent forever: a microphone that never
     opened wrote nothing to the done screen, on that round and on every
     round after it. It is now said on the topic screen, before the clock,
     where fixing it still costs nothing. */
  it("says the microphone cannot be heard before the clock, when the round is listening", async () => {
    localStorage.setItem("impromptu.prefs", JSON.stringify({ mic: "on" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Round bank={bank} signedIn={false} />);

    await user.click(await screen.findByRole("button", { name: "Spin" }));
    await screen.findByText(/Low tide|Queues|Tipping should end/);
    // jsdom has no getUserMedia, which is the refused case exactly.
    expect(await screen.findByText(/We can't hear your microphone/)).toBeInTheDocument();
  });

  it("names the duration on the button and says 'a minute' rather than '1 minutes'", () => {
    expect(thinkLabel(60)).toBe("Think for a minute");
    expect(thinkLabel(120)).toBe("Think for 2 minutes");
    expect(thinkLabel(0)).toBe("Start talking");
    expect(lengthWords(90)).toBe("1 min 30s");
    expect(lengthWords(0)).toBe("None");
  });
});
