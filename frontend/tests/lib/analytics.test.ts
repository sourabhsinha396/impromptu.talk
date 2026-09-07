import { afterEach, describe, expect, it, vi } from "vitest";

import { POSTHOG_HOST, analyticsConfig, attach, track } from "@/lib/analytics";

afterEach(() => attach(null));

describe("analyticsConfig", () => {
  const token = "phc_test_token_000";

  it("needs DEBUG_ENV to say production and a token; either alone sends nothing", () => {
    expect(analyticsConfig({ DEBUG_ENV: "production", NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token })).toEqual({
      token,
      host: POSTHOG_HOST,
    });
    expect(analyticsConfig({ DEBUG_ENV: "local", NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token })).toBeNull();
    expect(analyticsConfig({ DEBUG_ENV: "production", NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "" })).toBeNull();
    expect(analyticsConfig({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token })).toBeNull();
  });

  /* A typo makes the site quieter, never quietly start collecting. */
  it("accepts only the exact word production", () => {
    for (const env of ["Production", "prod", "PRODUCTION", " production"]) {
      expect(analyticsConfig({ DEBUG_ENV: env, NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token })).toBeNull();
    }
  });

  it("does not ride on the build mode: a production build on a laptop is not traffic", () => {
    expect(analyticsConfig({ NODE_ENV: "production", NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token })).toBeNull();
  });

  it("uses the configured host over the default", () => {
    const config = analyticsConfig({
      DEBUG_ENV: "production",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: token,
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    });
    expect(config?.host).toBe("https://eu.i.posthog.com");
  });
});

describe("track", () => {
  /* A visitor can spin inside two seconds, before the library has landed;
     that event is the one that matters most and is not lost. */
  it("holds events fired before anything is attached and delivers them in order", () => {
    track("spin_started", { genre: "general" });
    track("topic_shown", { genre: "general" });
    const sink = vi.fn();
    attach(sink);
    expect(sink.mock.calls).toEqual([
      ["spin_started", { genre: "general" }],
      ["topic_shown", { genre: "general" }],
    ]);
    track("prep_started", {});
    expect(sink).toHaveBeenLastCalledWith("prep_started", {});
  });

  it("never throws, whatever the sink does", () => {
    attach(() => {
      throw new Error("network");
    });
    expect(() => track("spin_started")).not.toThrow();
  });
});
