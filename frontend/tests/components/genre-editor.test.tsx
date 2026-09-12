/* The editor draws both kinds of row: prompts, and the passages of a
   warm-up. They are two tables on the backend and two shapes on the wire
   (docs/DECISIONS.md), and what is pinned here is that the one component
   never draws one kind with the other's rules. */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Editor } from "@/components/genres/editor";
import type { OwnedGenre } from "@/lib/owned";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const STYLES = [
  { key: "surprise", label: "Surprise me", hint: "" },
  { key: "just-talk", label: "Just talk", hint: "" },
  { key: "hot-take", label: "Hot take", hint: "" },
];

const PASSAGE =
  "She sells seashells by the seashore, and the shells she sells are surely seashells, so if she sells " +
  "shells on the seashore the shells she sells are seashore shells. She sells sixty shells for a shilling, " +
  "she says, so she should sell six hundred shells for ten.";

const WARM_UP: OwnedGenre = {
  slug: "my-twisters",
  name: "My twisters",
  icon: "mic",
  mode: "read",
  topic_count: 1,
  max_topics: 50,
  share_token: null,
  own_styles: [],
  topics: [{ id: 4, text: PASSAGE, level: "easy", words: 48 }],
};

const PROMPTS: OwnedGenre = {
  slug: "my-prompts",
  name: "My prompts",
  icon: "mic",
  topic_count: 1,
  share_token: null,
  own_styles: [],
  topics: [{ id: 9, text: "Tell me about yourself", style: "hot-take", style_label: "Hot take" }],
};

function draw(genre: OwnedGenre) {
  render(<Editor genre={genre} styles={STYLES} isPro canGenerate={false} generationsLeft={0} maxTopics={200} />);
  fireEvent.click(screen.getByLabelText(`Edit ${genre.topics[0].text}`));
}

describe("editing a passage", () => {
  it("gives it room for a paragraph rather than a prompt's 200 characters", () => {
    /* The bug. The field was capped at a prompt's ceiling while a passage
       runs to 1200, so opening one for a small change silently cut it to
       200 characters in the input, and the next press saved the fragment
       with nothing anywhere saying so. */
    draw(WARM_UP);
    const field = screen.getByDisplayValue(PASSAGE);
    expect(PASSAGE.length).toBeGreaterThan(200);
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.getAttribute("maxLength")).toBe("1200");
  });

  it("offers the two levels and no way to coin a third", () => {
    /* Nobody chooses how to say words they are reading verbatim, so a
       passage has one axis and it is not the style select. */
    draw(WARM_UP);
    // Scoped to the row being edited: the paste box above it carries a
    // style select of its own, which a warm-up hides rather than drops.
    const row = screen.getByDisplayValue(PASSAGE).closest("li") as HTMLElement;
    expect(within(row).getAllByRole("option").map((option) => option.textContent)).toEqual(["Easy", "Hard"]);
    expect(within(row).queryByText("Name a style")).toBeNull();
  });

  it("says its level and its length, because the scroller's speed is in words a minute", () => {
    render(
      <Editor genre={WARM_UP} styles={STYLES} isPro canGenerate={false} generationsLeft={0} maxTopics={200} />,
    );
    expect(screen.getByText("easy · 48 words")).toBeTruthy();
  });
});

describe("editing a prompt", () => {
  it("keeps the one-line field, the prompt ceiling and the styles it may coin", () => {
    draw(PROMPTS);
    const field = screen.getByDisplayValue("Tell me about yourself");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("maxLength")).toBe("200");
    expect(screen.getByText("Name a style")).toBeTruthy();
  });
});
