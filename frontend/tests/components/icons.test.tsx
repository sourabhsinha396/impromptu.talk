import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_ICON, GenreIcon, ICONS, STYLE_ICONS, TOOL_ICONS, validIcon } from "@/components/site/icons";

/* The 26 marks a genre may wear (the backend keeps the same list and the
   seeder writes ten of them), the five styles, and the four operator tools.
   Every emoji v0 drew is a glyph now, and a slug without one here is a mark
   that draws nothing. */
const STYLES = ["surprise", "just-talk", "hot-take", "explain", "story"];
const TOOLS = ["staged-topic", "pro", "payouts", "outreach"];
const BUILT_IN_GENRE_ICONS = [
  "dices",
  "coffee",
  "heart",
  "briefcase",
  "banknote",
  "bot",
  "microscope",
  "dumbbell",
  "brain",
  "clapperboard",
];

const drawn = (element: React.ReactElement) => render(element).container.querySelector("svg")?.innerHTML ?? "";

describe("icons", () => {
  it("covers every mark the bank and the chrome need, each with its own silhouette", () => {
    expect(Object.keys(ICONS)).toHaveLength(26);
    for (const slug of BUILT_IN_GENRE_ICONS) expect(slug in ICONS).toBe(true);
    expect(Object.keys(STYLE_ICONS).sort()).toEqual([...STYLES].sort());
    expect(Object.keys(TOOL_ICONS).sort()).toEqual([...TOOLS].sort());

    const silhouettes = Object.keys(ICONS).map((slug) => drawn(<GenreIcon icon={slug} />));
    expect(silhouettes.every(Boolean)).toBe(true);
    expect(new Set(silhouettes).size).toBe(silhouettes.length);
  });

  it("draws the default mark for an icon we do not offer, never what was posted", () => {
    expect(validIcon("rocket")).toBe("rocket");
    expect(validIcon("<script>")).toBe(DEFAULT_ICON);
    expect(validIcon(null)).toBe(DEFAULT_ICON);
    expect(drawn(<GenreIcon icon="nope" />)).toBe(drawn(<GenreIcon icon={DEFAULT_ICON} />));
  });
});
