import { afterEach, describe, expect, it } from "vitest";

import { THEME_KEY, applyTheme, themeInit } from "@/lib/theme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.removeItem(THEME_KEY);
});

describe("theme", () => {
  it("applies a stored choice before first paint, under the key v0 used, and ignores junk", () => {
    localStorage.setItem("impromptu.theme", "dark");
    new Function(themeInit)();
    expect(document.documentElement.dataset.theme).toBe("dark");

    delete document.documentElement.dataset.theme;
    localStorage.setItem("impromptu.theme", "purple");
    new Function(themeInit)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("stores light and dark, and forgets the choice for system so the media query decides", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
