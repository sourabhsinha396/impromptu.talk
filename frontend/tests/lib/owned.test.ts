import { describe, expect, it } from "vitest";

import type { Bank } from "@/lib/bank";
import { isOwnSlug, withOwn, withShared, type OwnedGenre, type SharedGenre } from "@/lib/owned";

const BANK: Bank = {
  genres: [{ slug: "career", name: "Career & work", icon: "briefcase", blurb: "Work." }],
  topics: [{ text: "Your first job", genre: "career", style: "just-talk", slug: "your-first-job" }],
  styles: [],
};

const MINE: OwnedGenre = {
  slug: "career",
  name: "Career",
  icon: "mic",
  topic_count: 1,
  share_token: null,
  topics: [{ id: 7, text: "Tell me about yourself", style: "Panel round", style_label: "Panel round" }],
  own_styles: ["Panel round"],
};

const SHARED: SharedGenre = {
  name: "Interview questions",
  icon: "mic",
  owner_name: "Ada",
  token: "7Kq2mVx0pR8sT1uY",
  topics: [{ id: 3, text: "Why this job", style: "hot-take", style_label: "Hot take" }],
};

describe("folding somebody's own genres into the bank", () => {
  it("keeps a genre of theirs off a built-in slug of the same name", () => {
    /* The slugs are one flat namespace the picker, the reel and
       /genre/<slug> all key on, so "career" of theirs must never be the
       bank's "career". */
    const bank = withOwn(BANK, [MINE]);
    expect(bank.genres.map((genre) => genre.slug)).toEqual(["career", "yours:career"]);
    expect(bank.topics.filter((topic) => topic.genre === "career")).toHaveLength(1);
    expect(isOwnSlug("yours:career")).toBe(true);
  });

  it("marks them as theirs so the picker lists them under Yours", () => {
    expect(withOwn(BANK, [MINE]).genres[1].own).toBe(true);
  });

  it("carries a coined style through untouched, since the round reads it as a filter", () => {
    expect(withOwn(BANK, [MINE]).topics[1].style).toBe("Panel round");
  });

  it("leaves the bank alone when there is nothing to fold in", () => {
    expect(withOwn(BANK, [])).toBe(BANK);
  });

  it("gives a shared genre the token as its slug, which is what the link names", () => {
    /* `/?genre=<token>` picks a genre by finding that slug in the bank,
       so the two have to be the same string. */
    const bank = withShared(BANK, SHARED);
    expect(bank.genres[1].slug).toBe(SHARED.token);
    expect(bank.topics[1].genre).toBe(SHARED.token);
    expect(bank.genres[1].blurb).toBe("Shared by Ada");
  });
});
