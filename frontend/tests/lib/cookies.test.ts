import { afterEach, describe, expect, it } from "vitest";

import { TIMEZONE_COOKIE, referralCode, timezoneInit } from "@/lib/cookies";

describe("referralCode", () => {
  it("accepts lowercase letters and digits and lowercases on the way", () => {
    expect(referralCode("Priya42")).toBe("priya42");
    expect(referralCode("  ab ")).toBe("ab");
  });

  it("refuses anything that could not be a code", () => {
    expect(referralCode(null)).toBe("");
    expect(referralCode("")).toBe("");
    expect(referralCode("a")).toBe("");
    expect(referralCode("a".repeat(25))).toBe("");
    expect(referralCode("pri-ya")).toBe("");
    expect(referralCode("x; Path=/")).toBe("");
  });
});

describe("timezoneInit", () => {
  afterEach(() => {
    document.cookie = `${TIMEZONE_COOKIE}=; path=/; max-age=0`;
  });

  it("writes the browser's zone, percent-encoded, before anything else runs", () => {
    new Function(timezoneInit)();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(document.cookie).toContain(`${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}`);
  });

  it("leaves a zone that is already written alone", () => {
    document.cookie = `${TIMEZONE_COOKIE}=Asia%2FKolkata; path=/`;
    new Function(timezoneInit)();
    expect(document.cookie).toContain(`${TIMEZONE_COOKIE}=Asia%2FKolkata`);
  });
});
