import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeSegment } from "@/components/site/theme-segment";
import { THEME_KEY } from "@/lib/theme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.removeItem(THEME_KEY);
});

describe("ThemeSegment", () => {
  it("shows the three stops at once, pressed on what the pre-paint script applied", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeSegment />);
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
  });

  it("applies and remembers a choice, and hands it back to the system on Auto", async () => {
    render(<ThemeSegment />);
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  });
});
