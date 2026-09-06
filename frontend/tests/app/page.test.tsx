import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("home", () => {
  it("asks the one question and keeps the h1 for crawlers", () => {
    render(<Home />);
    expect(screen.getByText("Can you talk for a minute?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("sr-only");
  });
});
