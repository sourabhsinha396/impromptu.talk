import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BOTTOM_LINE, Footer } from "@/components/site/footer";

describe("Footer", () => {
  /* The line read "Nothing uploaded." to both until accounts shipped, which
     made it a claim that was false for exactly the people who had trusted us
     with something. Both halves are pinned so it cannot drift back. */
  it("promises a stranger they need no account, and says something else to someone signed in", () => {
    const { unmount } = render(<Footer signedIn={false} inIndia={false} />);
    expect(screen.getByText(BOTTOM_LINE.signedOut)).toBeInTheDocument();
    expect(screen.queryByText(BOTTOM_LINE.signedIn)).not.toBeInTheDocument();
    unmount();

    render(<Footer signedIn inIndia={false} />);
    expect(screen.getByText(BOTTOM_LINE.signedIn)).toBeInTheDocument();
    expect(screen.queryByText(/your streak lives in this browser/)).not.toBeInTheDocument();
  });

  it("says it is made in India only to a visitor in India, and never guesses out loud", () => {
    const { unmount } = render(<Footer signedIn={false} inIndia={false} />);
    expect(screen.queryByText(/made in India/)).not.toBeInTheDocument();
    unmount();

    render(<Footer signedIn={false} inIndia />);
    expect(screen.getByText(/Proudly made in India/)).toBeInTheDocument();
  });

  it("puts the name, what it does and who owns it together, with the year", () => {
    render(<Footer signedIn={false} inIndia={false} year={2026} />);
    expect(screen.getByText(/© 2026 impromptu\.talk/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All genres" })).toHaveAttribute("href", "/genres");
    expect(screen.getByRole("link", { name: "Refund policy" })).toHaveAttribute("href", "/refunds");
    expect(screen.getByRole("link", { name: "hello@impromptu.talk" })).toHaveAttribute(
      "href",
      "mailto:hello@impromptu.talk",
    );
  });
});
