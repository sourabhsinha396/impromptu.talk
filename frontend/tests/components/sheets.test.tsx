import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Round } from "@/components/round/round";
import type { Bank } from "@/lib/bank";
import { PREFS_KEY } from "@/lib/round/prefs";

function topic(genre: string, text: string, style = "just-talk") {
  return { text, genre, style, slug: text.toLowerCase().replace(/\s+/g, "-") };
}

const bank: Bank = {
  genres: [
    { slug: "general", name: "General", icon: "dices", blurb: "" },
    { slug: "career", name: "Career & work", icon: "briefcase", blurb: "" },
    { slug: "yours:standups", name: "Standups", icon: "mic", blurb: "", own: true },
  ],
  topics: [
    topic("general", "Low tide"),
    topic("career", "Your first job"),
    topic("yours:standups", "Our standup", "IELTS style"),
  ],
  styles: [
    { key: "surprise", label: "Surprise me", hint: "Any style. The default." },
    { key: "just-talk", label: "Just talk", hint: "An open prompt." },
    { key: "hot-take", label: "Hot take", hint: "Pick a side." },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

const saved = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");

describe("the sheets", () => {
  it("picks a genre from one flat list, with Yours last for a stranger and a way to make their own", async () => {
    const user = userEvent.setup();
    render(<Round bank={bank} signedIn={false} />);
    await user.click(await screen.findByRole("button", { name: "General" }));
    const list = screen.getByRole("listbox", { name: "Genres" });
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["General", "Career & work"]);
    expect(within(list).getByRole("option", { name: "General" })).toHaveAttribute("aria-selected", "true");
    const dialog = screen.getByRole("dialog");
    const own = within(dialog).getByRole("option", { name: "Standups" });
    expect(own.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    /* Three doors, and each answers a different question (the picker
       mock, variant D): the heading edits the group, the pencil edits
       this one genre, and the row at the foot only ever means a new one.
       The identity glyph is never one of them. */
    expect(within(dialog).getByRole("link", { name: "Make a new genre" })).toHaveAttribute("href", "/genres/yours");
    expect(within(dialog).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/genres/yours");
    expect(within(dialog).getByRole("link", { name: "Edit Standups" })).toHaveAttribute(
      "href",
      "/genres/yours/standups",
    );

    await user.click(within(list).getByRole("option", { name: "Career & work" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Career & work" })).toBeInTheDocument();
    expect(saved().genre).toBe("career");
  });

  it("never puts an action in the identity column, and says the cap once", async () => {
    /* The complaint the picker mock was written about: a genre saved
       with the pencil icon made the identity glyph read as an edit
       button. An action lives at the right edge, beside the check, and
       a built-in never carries one at all. */
    const user = userEvent.setup();
    render(<Round bank={bank} signedIn isPro ownCap={10} />);
    await user.click(await screen.findByRole("button", { name: "General" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText(/1 of 10/)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("link", { name: /^Edit / })).toHaveLength(1);
    expect(within(dialog).queryByRole("link", { name: "Edit General" })).not.toBeInTheDocument();
  });

  it("changes the lengths live, writes them on release, offers a coined style only in its genre, and mutes a page in", async () => {
    const user = userEvent.setup();
    render(<Round bank={bank} signedIn={false} />);
    await user.click(await screen.findByRole("button", { name: "Settings" }));

    const talking = screen.getByLabelText("Talking time");
    fireEvent.change(talking, { target: { value: "120" } });
    expect(screen.getByText("Can you talk for 2 minutes?")).toBeInTheDocument();
    expect(saved().speak).toBeUndefined();
    fireEvent.keyUp(talking, { key: "ArrowRight" });
    expect(saved().speak).toBe(120);

    const style = screen.getByLabelText("Style") as HTMLSelectElement;
    expect([...style.options].map((o) => o.value)).toEqual(["surprise", "just-talk", "hot-take"]);
    await user.selectOptions(style, "hot-take");
    expect(saved().style).toBe("hot-take");
    expect(screen.getByText("Pick a side.")).toBeInTheDocument();

    /* The sound lives a page in, the way the account's own second page
       holds what is set once: the front page of the sheet is only what
       gets changed before a round. */
    expect(screen.queryByLabelText("Mute sound effects")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Additional settings" }));
    expect(screen.queryByLabelText("Talking time")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Mute sound effects"));
    expect(saved().sound).toBe(false);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Talking time")).toBeInTheDocument();

    /* The coined style belongs to the owned genre: it appears there and
       nowhere else. */
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "General" }));
    await user.click(screen.getByRole("option", { name: "Standups" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect([...(screen.getByLabelText("Style") as HTMLSelectElement).options].map((o) => o.value)).toContain("IELTS style");
  });
});
