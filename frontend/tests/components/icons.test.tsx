import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PACK_ICON,
  STYLE_ICONS,
  GENRE_ICONS,
  GenreIcon,
  PACK_ICONS,
  PackIcon,
  TOOL_ICONS,
  validPackIcon,
} from "@/components/site/icons";

/* The ten genres and five styles v0 seeds (its formats), the four operator tools, and
   the 24 badges its pack picker offered. Every emoji among them is a glyph
   now, and a slug without one here is a swatch that draws nothing. */
const GENRES = [
  "general",
  "everyday-life",
  "relationships",
  "career",
  "money-business",
  "tech-ai",
  "science",
  "health",
  "philosophy",
  "culture",
];
const STYLES = ["surprise", "just-talk", "hot-take", "explain", "story"];
const TOOLS = ["staged-topic", "pro", "payouts", "outreach"];

const drawn = (element: React.ReactElement) => render(element).container.querySelector("svg")?.innerHTML ?? "";

describe("icons", () => {
  it("covers every emoji v0 drew, each genre with its own silhouette", () => {
    expect(Object.keys(GENRE_ICONS).sort()).toEqual([...GENRES].sort());
    expect(Object.keys(STYLE_ICONS).sort()).toEqual([...STYLES].sort());
    expect(Object.keys(TOOL_ICONS).sort()).toEqual([...TOOLS].sort());
    expect(Object.keys(PACK_ICONS)).toHaveLength(24);

    const silhouettes = GENRES.map((slug) => drawn(<GenreIcon slug={slug} />));
    expect(silhouettes.every(Boolean)).toBe(true);
    expect(new Set(silhouettes).size).toBe(GENRES.length);
  });

  it("draws the default badge for a pack icon we do not offer, never what was posted", () => {
    expect(validPackIcon("rocket")).toBe("rocket");
    expect(validPackIcon("<script>")).toBe(DEFAULT_PACK_ICON);
    expect(validPackIcon(null)).toBe(DEFAULT_PACK_ICON);
    expect(drawn(<PackIcon icon="nope" />)).toBe(drawn(<PackIcon icon={DEFAULT_PACK_ICON} />));
  });
});
