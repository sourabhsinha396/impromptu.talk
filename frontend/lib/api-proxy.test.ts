import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardApiRequest } from "@/lib/api-proxy";

describe("forwardApiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the browser's cookies and returns the backend's Set-Cookie headers", async () => {
    const sent = vi.fn().mockResolvedValue(
      new Response('{"status":"ok"}', {
        headers: {
          "content-type": "application/json",
          "set-cookie": "impromptu_device=fresh; HttpOnly; Path=/; SameSite=Lax",
        },
      }),
    );
    vi.stubGlobal("fetch", sent);
    const request = new Request("http://localhost:3009/api/v1/auth/login?next=%2Faccount", {
      method: "POST",
      headers: { cookie: "impromptu_session=current; impromptu_device=old", "content-type": "application/json" },
      body: '{"email":"speaker@example.com"}',
    });

    const response = await forwardApiRequest(request, ["v1", "auth", "login"]);
    const upstream = sent.mock.calls[0]?.[0] as Request;

    expect(upstream.url).toBe("http://127.0.0.1:8009/api/v1/auth/login?next=%2Faccount");
    expect(upstream.headers.get("cookie")).toBe("impromptu_session=current; impromptu_device=old");
    expect(upstream.method).toBe("POST");
    expect(await upstream.text()).toBe('{"email":"speaker@example.com"}');
    expect(response.headers.get("set-cookie")).toContain("impromptu_device=fresh");
  });

  it("sends a GET without a body", async () => {
    const sent = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", sent);
    await forwardApiRequest(new Request("http://localhost:3009/api/v1/common/health"), ["v1", "common", "health"]);
    const upstream = sent.mock.calls[0]?.[0] as Request;
    expect(upstream.url).toBe("http://127.0.0.1:8009/api/v1/common/health");
    expect(upstream.body).toBeNull();
  });
});
