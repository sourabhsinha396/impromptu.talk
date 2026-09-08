import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonePhase } from "@/components/round/phases";

/* The seconds between the run landing and the reading landing. Both
   drawings of the report wait, and what is pinned here is the promise the
   wait is allowed to make: the shape of a report, at the size it will be,
   naming nothing it might not have. */

const waiting = (filming: boolean) => (
  <DonePhase
    summary={{ streak: 7, topics: 23, minutes: 24 }}
    report={null}
    runId={30}
    spokenSeconds={45}
    signedIn
    filming={filming}
    topic="Meetings should be optional"
    onAgain={() => {}}
    onSame={() => {}}
  />
);

describe("waiting for the report", () => {
  it.each([
    ["the reading report", false],
    ["the filming report", true],
  ])("names no measure on %s, because half of them need a transcript nobody is promised", (_, filming) => {
    /* A frame with "Pace" or "Answered the topic" written on it is a
       promise broken on every free round and on every round whose
       provider was down: those cards never arrive. Unnamed, the frame
       claims only that a report of about this size is coming. Nothing on
       screen would show this being lost, since the words would look
       right to whoever added them. */
    render(waiting(filming));
    for (const measure of ["Pace", "Longest gap", "Time to start", "Ums a minute", "Answered the topic"]) {
      expect(screen.queryByText(measure)).not.toBeInTheDocument();
    }
  });

  it.each([
    ["the reading report", false],
    ["the filming report", true],
  ])("draws the clock it already holds on %s, so the row does not move when the reading lands", (_, filming) => {
    // The browser timed the round itself and never needed the server for
    // it, so the one honest number is on screen from the first frame.
    render(waiting(filming));
    expect(screen.getByText("0:45")).toBeInTheDocument();
  });

  it("heads the filming board with the topic, which the reading would otherwise bring in late", () => {
    /* The landed board heads itself with the topic off the report. If the
       wait left that row out, the whole board would jump down a line at
       the moment the reading arrives, which is the one thing this drawing
       exists to avoid. */
    render(waiting(true));
    expect(screen.getByText("Meetings should be optional")).toBeInTheDocument();
    expect(screen.getByText("Day 7")).toBeInTheDocument();
  });

  it("only shimmers under motion-safe, so asking for less motion is honoured", () => {
    /* A screen of shapes crossed by a moving band is exactly the motion
       somebody turns off at the operating system. Under reduced motion
       the frame is still the right frame, it simply holds still. */
    const { container } = render(waiting(false));
    const bands = [...container.querySelectorAll("[class*=animate-shimmer]")];
    expect(bands.length).toBeGreaterThan(0);
    for (const band of bands) {
      expect(band.className).toContain("motion-safe:animate-shimmer");
      expect(band.className).not.toMatch(/(^|\s)animate-shimmer/);
    }
  });

  it("says nothing to a screen reader about the shapes, only that the round is being read", () => {
    // Nine nameless blocks announced one by one is a layout read aloud.
    const { container } = render(waiting(false));
    const status = container.querySelector("[role=status]");
    expect(status?.textContent).toContain("Analyzing your speech");
    // `~=` and not `*=`: the band crossing each shape is `bg-linear-to-r`,
    // which a substring match would sweep up along with the shapes.
    for (const shape of container.querySelectorAll('[class~="bg-line"]')) {
      expect(shape).toHaveAttribute("aria-hidden");
    }
  });
});
