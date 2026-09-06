import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_BANK, fetchBank } from "@/lib/bank";

describe("fetchBank", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for the public bank with no cookies and keeps it for an hour", async () => {
    const sent = vi.fn().mockResolvedValue(new Response('{"genres":[],"topics":[],"styles":[]}'));
    vi.stubGlobal("fetch", sent);
    await fetchBank();
    const [url, init] = sent.mock.calls[0] as [string, { next?: { revalidate?: number }; headers?: unknown }];
    expect(url).toMatch(/\/api\/v1\/topics\/bank$/);
    expect(init.next?.revalidate).toBe(3600);
    expect(init.headers).toBeUndefined();
  });

  it("never fails the page: an unreachable backend is an empty bank", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchBank()).toEqual(EMPTY_BANK);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    expect(await fetchBank()).toEqual(EMPTY_BANK);
  });
});
