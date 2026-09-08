import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonePhase } from "@/components/round/phases";
import type { Report } from "@/lib/report";

/* The report drawn to be filmed. What is pinned here is what the switch
   decides and what a card is allowed to say: the same measures as the
   reading report, more of the round than the reading report shows, and no
   card at all where the round has no numbers for one. */

const REPORT: Report = {
  heard: true,
  speaking_seconds: 50,
  opening_stall: 1,
  pauses: [{ at: 20, seconds: 6, awkward: true }],
  longest_pause: 6,
  awkward_pauses: 1,
  speaking_ratio: 0.9,
  trail_off: 1,
  words: 138,
  pace: 143,
  fillers: 4,
  filler_rate: 4,
  crutch_words: [{ word: "actually", count: 3 }],
  filler_words: ["um"],
  fillers_at_transitions: 1,
  transcript: "Meetings are actually optional and um we should say so.",
  said: [],
  topic: "Meetings should be optional",
  at: "2026-09-08T12:00:00Z",
  genre_slug: "career",
  seconds_left: 0,
  pace_curve: [],
  filler_times: [{ word: "um", at: 8 }],
  filler_counts: [{ word: "um", count: 4 }],
  leaned_on: [{ word: "actually", count: 3 }],
  restarts: [{ quote: "we should - we should", at: 12 }],
  repeats: [],
  sentences: [{ text: "Meetings are actually optional.", words: 41, role: "", at: null, end: null }],
  ended_clean: true,
  usual: null,
  case: { answered: "yes", verdict: "You made the case and stayed on it.", advice: "Open sooner." },
};

const done = (filming: boolean, report: Report = REPORT) => (
  <DonePhase
    summary={{ streak: 7, topics: 23, minutes: 24 }}
    report={report}
    runId={30}
    spokenSeconds={60}
    signedIn
    filming={filming}
    onAgain={() => {}}
    onSame={() => {}}
  />
);

describe("the report sized for filming", () => {
  it("replaces the streak tiles with the reading, and keeps the numbers the reading report shows", () => {
    render(done(true));
    // The streak is a word in the head, not three tiles: tiles above the
    // fold push the reading off the bottom of a laptop, which is the
    // whole reason this drawing exists.
    expect(screen.getByText("Day 7")).toBeInTheDocument();
    expect(screen.queryByText("day streak")).not.toBeInTheDocument();
    // The same measures as the ordinary report, to the same numbers.
    expect(screen.getByText("Longest pause")).toBeInTheDocument();
    expect(screen.getByText("6s")).toBeInTheDocument();
    // The number alone on a card: "143 words a minute" at 40 pixels ran
    // out of the card, and the card's own title already says Pace.
    expect(screen.getByText("143")).toBeInTheDocument();
    // And more of the round than the done screen has ever shown.
    expect(screen.getByText("Words you used a lot")).toBeInTheDocument();
    expect(screen.getByText("Answered the topic")).toBeInTheDocument();
    expect(screen.getByText("Restarts")).toBeInTheDocument();
  });

  it("draws no verdict card on a round nothing read, rather than a box saying nothing", () => {
    render(done(true, { ...REPORT, case: null }));
    expect(screen.queryByText("Answered the topic")).not.toBeInTheDocument();
    expect(screen.getByText("Longest pause")).toBeInTheDocument();
  });

  it("is off by default, and a round nobody listened to keeps the ordinary done screen", () => {
    const { unmount } = render(done(false));
    expect(screen.getByText("Day 7.")).toBeInTheDocument();
    expect(screen.queryByText("Words you used a lot")).not.toBeInTheDocument();
    unmount();

    // Filming on, but no microphone behind the round: there is nothing to
    // fill a screen with, so the ordinary screen stands.
    render(
      <DonePhase
        summary={{ streak: 7, topics: 23, minutes: 24 }}
        report="off"
        runId={30}
        spokenSeconds={60}
        signedIn
        filming
        onAgain={() => {}}
        onSame={() => {}}
      />,
    );
    expect(screen.getByText("Day 7.")).toBeInTheDocument();
  });
});

/* The card that replaced the radar. The pentagon was drawn on the board
   with no axis labels and no key, which made five measures one olive
   blob; the same numbers as a row of bars need no legend at all. What is
   pinned here is what the card counts and what it is allowed to claim. */
describe("how the round went", () => {
  const usual = { pace: 143, stall: 1, gap: 6, fillers: 4, sentence: 41, rounds: 6 };
  const card = () => within(screen.getByText("How the round went").closest("div") as HTMLElement);

  it("counts the measures that landed in range, not the cards on the board", () => {
    /* The board draws a card for every measure and several things that
       are not measures at all. The count is of the five the bands judge,
       so a new card can never quietly change it. This round has a long
       pause and a run-on sentence, which is two of the five outside. */
    render(done(true));
    expect(card().getByText("3 of 5")).toBeInTheDocument();
    expect(card().getByText("in the good range")).toBeInTheDocument();
  });

  it("says how each measure went in words, so a bar is never read by colour alone", () => {
    // The length says it to anybody looking. Nothing says it to a screen
    // reader, and a rose bar and an olive one are the same shape.
    render(done(true));
    expect(card().getByText(/A long pause/)).toBeInTheDocument();
    expect(card().getByText(/Good pace/)).toBeInTheDocument();
  });

  it("compares with your usual only where every measure has a past", () => {
    /* A first round has no usual at all, and a count taken over four
       measures against one taken over five is not a comparison. */
    const { unmount } = render(done(true));
    expect(card().queryByText(/your usual/)).not.toBeInTheDocument();
    unmount();

    render(done(true, { ...REPORT, pace: 40, usual }));
    expect(card().getByText("Under your usual, which is 3 of 5.")).toBeInTheDocument();
  });
});
