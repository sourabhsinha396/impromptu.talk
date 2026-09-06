/* Every brand colour has to be legible as the topic, in both themes.

   This is the test the palette's existence rests on. The accent colours the
   topic, the largest text on the site and the thing people film from across
   a room, so offering a choice at all is only safe while every option in it
   is readable. Six checked colours are safe; a colour wheel could never be.

   It reads globals.css rather than a copy of the numbers, because a copy is
   a second list to keep in step and this exists precisely to stop the two
   drifting. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buttonClass } from "@/components/site/button";
import { ACCENTS, DEFAULT_ACCENT, validAccent } from "@/lib/palette";

const CSS = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

/* Display type. WCAG asks 4.5 of large text for AAA; the topic is far larger
   than the 24px that counts as large, so clearing it is the floor, not the
   aim. */
const FLOOR = 4.5;

const LIGHT_PAGE = "#ffffff";
const DARK_PAGE = "#080808";

/* oklch to sRGB, clamped: the same conversion a browser does. */
function srgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return [encode(linear[0]), encode(linear[1]), encode(linear[2])];
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hex(value: string): number[] {
  const digits = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255);
}

function contrast(rgb: number[], page: string): number {
  const [high, low] = [luminance(rgb), luminance(hex(page))].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

/* `{slug: [hue, chroma]}`, read straight out of the stylesheet. */
function hues(): Record<string, [number, number]> {
  const found: Record<string, [number, number]> = {};
  const rule = /\[data-accent="([a-z]+)"\]\s*\{[^}]*--accent-h:\s*([\d.]+);[^}]*--accent-c:\s*([\d.]+);/g;
  for (const [, slug, h, c] of CSS.matchAll(rule)) found[slug] = [Number(h), Number(c)];
  return found;
}

/* Every `--accent-l` declaration, in source order: light first, then the two
   dark copies. */
function lightnesses(): number[] {
  return [...CSS.matchAll(/--accent-l:\s*([\d.]+);/g)].map((m) => Number(m[1]));
}

const light = () => lightnesses()[0];
const dark = () => lightnesses()[1];

describe("the stylesheet agrees with the palette", () => {
  it("defines every offered accent, so no swatch silently does nothing", () => {
    expect(Object.keys(hues()).sort()).toEqual(Object.keys(ACCENTS).sort());
  });

  it("has the default among them", () => {
    expect(DEFAULT_ACCENT in ACCENTS).toBe(true);
  });

  it("gives the light theme a darker accent than the dark one", () => {
    /* Inverting these would pass every contrast check below on the wrong page. */
    expect(light()).toBeLessThan(dark());
  });

  it("keeps the stored-choice and system-preference dark copies in step", () => {
    const [, chosen, followed] = lightnesses();
    expect(chosen).toBe(followed);
  });
});

describe.each(Object.keys(ACCENTS).sort())("%s is readable as the topic", (slug) => {
  it("on the dark page", () => {
    const [h, c] = hues()[slug];
    expect(contrast(srgb(dark(), c, h), DARK_PAGE)).toBeGreaterThanOrEqual(FLOOR);
  });

  it("on the light page", () => {
    const [h, c] = hues()[slug];
    expect(contrast(srgb(light(), c, h), LIGHT_PAGE)).toBeGreaterThanOrEqual(FLOOR);
  });
});

describe("the accent never paints the button", () => {
  /* The whole reason a settable colour is safe: it is never what marks the
     one thing you press. If the primary button goes back to the accent, a
     brand colour starts deciding which control is the obvious one. */
  it("keeps the primary button on its own token", () => {
    const classes = buttonClass("primary");
    expect(classes).toContain("bg-btn");
    expect(classes).not.toMatch(/bg-accent/);
  });
});

describe("validAccent", () => {
  it("keeps a slug we offer and turns anything else into the default", () => {
    expect(validAccent("coral")).toBe("coral");
    expect(validAccent("neon")).toBe("lime");
    expect(validAccent(null)).toBe("lime");
    expect(validAccent("")).toBe("lime");
  });
});
