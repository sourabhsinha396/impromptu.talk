import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GENRE_SLUGS } from "@/lib/genres";
import { OG_IMAGE, pageMetadata } from "@/lib/metadata";

describe("what crawlers read", () => {
  it("lists the tool, the genre pages that route into it and the paperwork, and nothing personal", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(urls).toContain("/");
    expect(urls).toContain("/genres");
    for (const slug of GENRE_SLUGS) expect(urls).toContain(`/genre/${slug}`);
    for (const path of ["/about", "/contact", "/privacy", "/terms", "/refunds", "/pro", "/affiliate"]) {
      expect(urls).toContain(path);
    }
    /* The 800 topic permalinks are crawlable from their genre pages and
       would drown the hint; a share page is one person's round; the
       operator paths answer strangers with a 404. */
    expect(urls.some((path) => path.startsWith("/topic/"))).toBe(false);
    expect(urls.some((path) => path.startsWith("/s/"))).toBe(false);
    expect(urls.some((path) => path.includes("admin"))).toBe(false);
    expect(urls[0]).toBe("/");
    /* Not a redirect, not a page: a topic route would be 800 thin pages
       again, and the genre page is where a topic is readable. */
    expect(existsSync(path.resolve(import.meta.dirname, "../../app/topic"))).toBe(false);
  });

  it("keeps crawlers off the pages that say nothing to them and points them at the sitemap", () => {
    const { rules, sitemap: sitemapUrl } = robots();
    const disallow = (rules as { disallow: string[] }).disallow;
    expect(disallow).toEqual(expect.arrayContaining(["/streak", "/administration", "/affiliate/referrals"]));
    expect(sitemapUrl).toMatch(/\/sitemap\.xml$/);
  });

  it("makes the tab, the canonical and both cards agree, off one title and description", () => {
    const meta = pageMetadata({ title: "All genres", description: "Ten genres.", path: "/genres" });
    expect(meta.alternates?.canonical).toBe("/genres");
    expect(meta.openGraph).toMatchObject({ title: "All genres", description: "Ten genres.", images: [OG_IMAGE] });
    expect(String(meta.openGraph?.url)).toMatch(/\/genres$/);
    expect(meta.twitter).toMatchObject({ title: "All genres", images: [OG_IMAGE] });
  });
});
