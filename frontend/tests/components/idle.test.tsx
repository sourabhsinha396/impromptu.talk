import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Idle, speakingLength } from "@/components/round/idle";

describe("Idle", () => {
  it("asks the one question with the speaking length from the setting, and offers one button", () => {
    render(<Idle genre={{ name: "General", icon: "dices" }} speakSeconds={120} />);
    expect(screen.getByText("Can you talk for 2 minutes?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("sr-only");
  });

  it("says a minute rather than 1 minutes", () => {
    expect(speakingLength(60)).toBe("a minute");
    expect(speakingLength(120)).toBe("2 minutes");
    expect(speakingLength(600)).toBe("10 minutes");
  });
});
