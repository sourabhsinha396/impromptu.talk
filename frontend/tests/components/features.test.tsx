import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeaturesPage } from "@/components/features/features-page";
import { Header } from "@/components/site/header";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe("the features page, an explicit override of AGENTS.md's \"no features page\"", () => {
  it("lists free-forever features as live links, Pro features locked for a free viewer", () => {
    render(<FeaturesPage isPro={false} />);
    expect(screen.getByRole("link", { name: /Streak/ })).toHaveAttribute("href", "/streak");
    /* A locked card is looked at, not clicked: no link role, no href - but
       its "Pro" badge is the one live thing on it, and it goes to /pro. */
    expect(screen.queryByRole("link", { name: /Custom genre.*Your own topics/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Pro" }).length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", { name: "Pro" })) {
      expect(link).toHaveAttribute("href", "/pro");
    }
  });

  it("never links a Soon badge anywhere, locked or not", () => {
    render(<FeaturesPage isPro={false} />);
    expect(screen.queryByRole("link", { name: "Soon" })).toBeNull();
    expect(screen.getAllByText("Soon").length).toBeGreaterThan(0);
  });

  it("unlocks the Pro cards, except the ones still marked Soon, for a Pro viewer", () => {
    render(<FeaturesPage isPro />);
    expect(screen.getByRole("link", { name: /Custom genre.*Your own topics/ })).toHaveAttribute("href", "/genres/yours");
    /* Image impromptu and its custom-genre counterpart are not built yet,
       so they stay unclickable whatever the viewer's plan. */
    expect(screen.queryByRole("link", { name: /Image impromptu/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Custom genre.*Your own pictures/ })).toBeNull();
    /* Already Pro, so the badge is a plain label rather than a link to
       the page selling the plan they're already on. */
    expect(screen.queryByRole("link", { name: "Pro" })).toBeNull();
  });

  it("puts Pro first for a Pro viewer and free-forever first for everyone else", () => {
    const { unmount } = render(<FeaturesPage isPro={false} />);
    const headingsFree = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headingsFree).toEqual(["Free forever", "Pro"]);
    unmount();
    render(<FeaturesPage isPro />);
    const headingsPro = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headingsPro).toEqual(["Pro", "Free forever"]);
  });
});

describe("the navbar", () => {
  it("carries one link into Features, beside the wordmark", () => {
    render(<Header user={null} streak={0} />);
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
  });
});
