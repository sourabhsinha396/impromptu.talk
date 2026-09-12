import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FREE_FEATURES, PRO_FEATURES } from "@/components/features/feature-list";
import { FeaturesPage } from "@/components/features/features-page";
import { FEATURE_ICONS } from "@/components/site/icons";
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

  it("unlocks every Pro card for a Pro viewer, uploads included", () => {
    render(<FeaturesPage isPro />);
    expect(screen.getByRole("link", { name: /Custom genre.*Your own topics/ })).toHaveAttribute("href", "/genres/yours");
    expect(screen.getByRole("link", { name: /Custom genre.*Upload your own pictures/ })).toHaveAttribute(
      "href",
      "/genres/yours",
    );
  });

  it("shows no Pro pill at all to somebody who is already Pro", () => {
    /* The badge and the lock are one condition. Labelling half of what a
       subscriber already owns with the name of the thing they already pay
       for is selling to somebody who has finished buying. */
    render(<FeaturesPage isPro />);
    expect(screen.queryByText("Pro", { selector: "a, span" })).toBeNull();
    /* The heading is still called Pro; it is the pills that go. */
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toContain("Pro");
  });

  it("leads with free forever, and does not rearrange itself once somebody is Pro", () => {
    /* The picker reorders for Pro because it promotes somebody's own
       genres. Nothing here is anybody's, so the page stays put and the
       reader keeps their bearings. */
    const { unmount } = render(<FeaturesPage isPro={false} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Free forever", "Pro"]);
    unmount();
    render(<FeaturesPage isPro />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Free forever", "Pro"]);
  });
  it("gives every card a glyph of its own, and a destination", () => {
    /* `FeatureIcon` falls back to a gear, so a card added without an entry
       draws a settings icon and nothing says so. Every card is also a
       promise that there is somewhere to go: a feature listed here with no
       surface behind it is the one thing this page must not do. */
    for (const feature of [...FREE_FEATURES, ...PRO_FEATURES]) {
      expect(FEATURE_ICONS[feature.slug], feature.slug).toBeDefined();
      expect(feature.href.startsWith("/"), feature.slug).toBe(true);
      expect(feature.blurb.length, feature.slug).toBeGreaterThan(0);
    }
    /* Slugs are what the icons are keyed on, so two cards sharing one
       would silently draw the same glyph for different things. */
    const slugs = [...FREE_FEATURES, ...PRO_FEATURES].map((feature) => feature.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("the navbar", () => {
  it("carries one link into Features, beside the wordmark", () => {
    render(<Header user={null} streak={0} />);
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
  });
});
