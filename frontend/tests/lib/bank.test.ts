import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_BANK, passagesByDifficulty, type ReadGenre } from "@/lib/bank";
import { fetchBank } from "@/lib/api";

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

describe("grouping a warm-up's passages", () => {
  const genre: ReadGenre = {
    slug: "tongue-twisters",
    name: "Tongue twisters",
    icon: "mic",
    blurb: "Read these aloud.",
    passages: [
      { text: "A hard one", slug: "a-hard-one", level: "hard", words: 3 },
      { text: "An easy one", slug: "an-easy-one", level: "easy", words: 3 },
      { text: "Another hard one", slug: "another-hard-one", level: "hard", words: 3 },
    ],
  };

  it("groups on the level, easy first, because the page leads with it", () => {
    /* `level` is what the wire carries now. Grouped on `style`, which is
       a prompt's axis and absent here, every group came back empty and
       the page rendered its headings over nothing. */
    expect(passagesByDifficulty(genre).map((group) => [group.label, group.passages.length])).toEqual([
      ["Easy", 1],
      ["Hard", 2],
    ]);
  });

  it("leaves out a level the bank happens not to hold", () => {
    const easyOnly = { ...genre, passages: genre.passages.filter((passage) => passage.level === "easy") };
    expect(passagesByDifficulty(easyOnly).map((group) => group.label)).toEqual(["Easy"]);
  });
});
