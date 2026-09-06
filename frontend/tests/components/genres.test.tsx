import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GenrePage } from "@/components/genres/genre-page";
import { Hub } from "@/components/genres/hub";
import type { Bank } from "@/lib/bank";

/* The real bank, read off the backend's files, so this is the same thousand
   topics the seeder writes and not a fixture that could drift from them. */
const TOPICS_DIR = path.resolve(import.meta.dirname, "../../../backend/data/topics");
const ORDER = [
  "general",
  "everyday-life",
  "relationships",
  "career",
  "money-business",
  "tech-ai",
  "science",
  "health",
  "philosophy",
  "culture",
];
const STYLES = [
  { key: "surprise", label: "Surprise me", hint: "" },
  { key: "just-talk", label: "Just talk", hint: "" },
  { key: "hot-take", label: "Hot take", hint: "" },
  { key: "explain", label: "Explain it simply", hint: "" },
  { key: "story", label: "Tell a story", hint: "" },
];

function realBank(): Bank {
  const files = readdirSync(TOPICS_DIR).filter((name) => name.endsWith(".json"));
  const genres = ORDER.map((slug) => {
    const file = JSON.parse(readFileSync(path.join(TOPICS_DIR, `${slug}.json`), "utf8")) as {
      genre: string;
      topics: { text: string; style: string }[];
    };
    return { slug, name: file.genre, icon: "dices", blurb: `About ${file.genre}.`, topics: file.topics };
  });
  expect(files).toHaveLength(genres.length);
  return {
    genres: genres.map(({ slug, name, icon, blurb }) => ({ slug, name, icon, blurb })),
    topics: genres.flatMap((genre) =>
      genre.topics.map((topic, index) => ({ text: topic.text, genre: genre.slug, style: topic.style, slug: `${genre.slug}-${index}` })),
    ),
    styles: STYLES,
  };
}

const bank = realBank();

describe("the genre pages, which are the growth plan", () => {
  it("prints every one of the thousand topics as text on its genre page, under a heading per style", () => {
    /* A topic has no page of its own, so this is the only place it is
       reachable, and nothing else would say so if one went missing. Each
       page is rendered once, never once per topic. */
    for (const genre of bank.genres) {
      const { container, unmount } = render(<GenrePage bank={bank} genre={genre} />);
      const text = container.textContent ?? "";
      for (const topic of bank.topics.filter((t) => t.genre === genre.slug)) {
        expect(text, `${topic.text} on ${genre.slug}`).toContain(topic.text);
      }
      const headings = within(container).getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
      expect(headings.some((h) => h.startsWith("Just talk"))).toBe(true);
      expect(headings.some((h) => h.startsWith("Tell a story"))).toBe(true);
      expect(headings.some((h) => h.startsWith("Surprise me"))).toBe(false);
      unmount();
    }
    expect(bank.topics).toHaveLength(1000);
  });

  it("reads as the long-tail query, opens the tool with the genre picked, and links every other genre", () => {
    const career = bank.genres.find((g) => g.slug === "career")!;
    render(<GenrePage bank={bank} genre={career} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Career & work speaking topics");
    expect(screen.getByRole("link", { name: "Practise this genre" })).toHaveAttribute("href", "/?genre=career");
    const more = within(screen.getByRole("navigation", { name: "More genres" })).getAllByRole("link");
    expect(more).toHaveLength(9);
    expect(more.map((a) => a.getAttribute("href"))).not.toContain("/genre/career");
  });

  it("lists the ten genres on the hub with their counts and one way into the tool", () => {
    render(<Hub bank={bank} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ten genres, 1000 topics.");
    const cards = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/genre/"));
    expect(cards).toHaveLength(10);
    expect(cards[0]).toHaveTextContent("80 topics");
    expect(screen.getByRole("link", { name: "Spin" })).toHaveAttribute("href", "/");
  });
});
