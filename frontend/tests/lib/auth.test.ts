import { describe, expect, it } from "vitest";

import { authHref, safeNext } from "@/lib/auth";

describe("safeNext", () => {
  it("keeps one of our own paths with its query and fragment", () => {
    expect(safeNext("/pro?currency=inr#plans")).toBe("/pro?currency=inr#plans");
  });

  it.each(["https://evil.example/", "//evil.example/", "/\\evil.example", "javascript:alert(1)", "streak", 42, undefined])(
    "sends %s to the tool instead",
    (value) => {
      expect(safeNext(value)).toBe("/");
    },
  );

  it("refuses a repeated next rather than picking one", () => {
    expect(safeNext(["/streak", "//evil.example"])).toBe("/");
  });
});

describe("authHref", () => {
  it("carries the continuation to the other door and drops it when it is the tool", () => {
    expect(authHref("/signup", "/pro?currency=inr")).toBe("/signup?next=%2Fpro%3Fcurrency%3Dinr");
    expect(authHref("/login", "/")).toBe("/login");
  });
});
