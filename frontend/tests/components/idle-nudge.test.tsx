import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Idle } from "@/components/round/idle";

const GENRE = { name: "General", icon: "dices" };

function gear(): Element | null {
  return screen.getByRole("button", { name: "Settings" }).querySelector("svg");
}

/* Its own file because the flag being pinned is module scope, and the other
   idle tests render this screen too: by the time they have run, the nudge is
   already spent. */
describe("the settings nudge", () => {
  it("turns the gear on the first visit to the home screen and never again", () => {
    const first = render(<Idle genre={GENRE} speakSeconds={60} />);
    expect(gear()).toHaveClass("motion-safe:animate-nudge");
    first.unmount();

    render(<Idle genre={GENRE} speakSeconds={60} />);
    expect(gear()).not.toHaveClass("motion-safe:animate-nudge");
  });
});
