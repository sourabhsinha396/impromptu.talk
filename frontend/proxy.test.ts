import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy, { config } from "@/proxy";

function requestFor(path: string, { cookie, method = "GET" }: { cookie?: string; method?: string } = {}) {
  return new NextRequest(`http://localhost:3008${path}`, { method, headers: cookie ? { cookie } : {} });
}

describe("proxy", () => {
  it("sends a visitor without a session cookie to sign in and brings them back", () => {
    const response = proxy(requestFor("/account"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Faccount");
  });

  it("gates everything under a signed-in page", () => {
    expect(proxy(requestFor("/packs/new")).headers.get("location")).toContain("/login");
    expect(proxy(requestFor("/affiliate/referrals")).headers.get("location")).toContain("/login");
  });

  it("lets a session cookie through", () => {
    const response = proxy(requestFor("/account", { cookie: "impromptu_session=abc" }));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not gate the home page or a lookalike path", () => {
    expect(proxy(requestFor("/")).headers.get("location")).toBeNull();
    expect(proxy(requestFor("/accounts-payable")).headers.get("location")).toBeNull();
  });

  it("leaves /administration to answer 404 for itself rather than confirm it exists", () => {
    expect(proxy(requestFor("/administration")).headers.get("location")).toBeNull();
  });

  it("turns ?ref= into the referral cookie for sixty days", () => {
    const response = proxy(requestFor("/genre/general?ref=Priya42"));
    const cookie = response.cookies.get("impromptu_ref");
    expect(cookie?.value).toBe("priya42");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 60);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
  });

  it("keeps the referral cookie on a redirect to sign in", () => {
    const response = proxy(requestFor("/account?ref=priya"));
    expect(response.headers.get("location")).toContain("/login");
    expect(response.cookies.get("impromptu_ref")?.value).toBe("priya");
  });

  it("ignores a ref that is not a code, and any ref on a post", () => {
    expect(proxy(requestFor("/?ref=x;%20Path=/")).cookies.get("impromptu_ref")).toBeUndefined();
    expect(proxy(requestFor("/?ref=priya", { method: "POST" })).cookies.get("impromptu_ref")).toBeUndefined();
  });

  it("runs on pages and not on the API rewrite or Next's assets", () => {
    const [pattern] = config.matcher;
    const matches = (path: string) => new RegExp(`^${pattern.replace(/\/\(\(\?!(.*)\)\.\*\)/, "/(?!$1).*")}$`).test(path);
    expect(matches("/")).toBe(true);
    expect(matches("/genre/general")).toBe(true);
    expect(matches("/api/v1/common/health")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
  });
});
