import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/site/button";

describe("Button", () => {
  it("renders a link when given an href, so a middle click still opens a tab", () => {
    render(<Button href="/genres">All genres</Button>);
    expect(screen.getByRole("link", { name: "All genres" })).toHaveAttribute("href", "/genres");
  });

  it("is ink for the primary action and never painted in the accent, in any variant", () => {
    /* The accent belongs to the topic. A brand colour must never decide
       which control is the obvious one, so no variant fills with it; the
       focus ring is the one place it appears, because that is where your
       focus is, not what you press. */
    render(<Button>Spin</Button>);
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Spin" }).className).toContain("bg-btn");
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).not.toMatch(/bg-accent|text-accent|border-accent/);
    }
  });

  it("looks locked and does nothing while disabled", async () => {
    /* The colour menu is offered to everybody and only its Save is closed:
       a button that looks live and does nothing is worse than no button. */
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button").className).toContain("disabled:opacity-40");
  });
});
