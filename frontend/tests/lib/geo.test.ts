import { describe, expect, it } from "vitest";

import { where } from "@/lib/geo";

describe("where", () => {
  it("believes a country header first, a timezone next, and a language region last", () => {
    expect(where("in", "en-US", "America/New_York")).toEqual(["IN", "country"]);
    expect(where(null, "en-US", "Asia/Kolkata")).toEqual(["IN", "timezone"]);
    expect(where(null, "pt-BR,pt;q=0.9", "")).toEqual(["BR", "language"]);
    expect(where(null, "", "")).toEqual(["", "default"]);
  });

  it("falls through a signal naming a place we do not price in, rather than believing it", () => {
    /* A country we cannot price in is no better an answer than none, and
       every caller is asking in order to do something per market. */
    expect(where("FR", "en-GB", "Europe/Zurich")).toEqual(["GB", "language"]);
    expect(where(null, "en", "Europe/Paris")).toEqual(["DE", "timezone"]);
    expect(where(null, "en", "Europe/Warsaw")).toEqual(["", "default"]);
  });

  it("reads only the region of a language, because a language is not a place", () => {
    expect(where(null, "hi", "")).toEqual(["", "default"]);
    expect(where(null, "hi-IN", "")).toEqual(["IN", "language"]);
  });
});
