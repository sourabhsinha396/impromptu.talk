import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseCards, CaseRead, SampleRead } from "@/components/streak/case";
import { SAMPLE_ROUNDS } from "@/lib/case";
import type { Case, Round, Sentence } from "@/lib/report";

/* What the section says, and the two things it must never say: that
   somebody missed the topic when nothing read their round, and that they
   made no point when they made one the clock could not place. */

const READ: Case = {
  answered: "half",
  verdict: "You said a good pen matters, then told the story and never came back to owning one.",
  advice: "After the story, come back. One sentence on why one good pen is worth owning.",
};

const SAID: Sentence[] = [
  { text: "A good pen is very essential for a pen fight.", words: 10, role: "point", at: 2.1, end: 5.1 },
  { text: "I remember the days when I used to play pen fight.", words: 11, role: "example", at: 6, end: 26.5 },
  { text: "He was also very good with it, but he lost.", words: 9, role: "example", at: 45.6, end: 54.4 },
];

describe("the case you made", () => {
  it("leads with the verdict and closes with one thing to do", () => {
    render(<CaseRead read={READ} sentences={SAID} length={58} />);
    expect(screen.getByText("Half answered.")).toBeInTheDocument();
    expect(screen.getByText(/never came back to owning one/)).toBeInTheDocument();
    expect(screen.getByText("Next time.")).toBeInTheDocument();
  });

  it("flags the point at the second it landed", () => {
    render(<CaseRead read={READ} sentences={SAID} length={58} />);
    expect(screen.getByText(/your point, 0:02/)).toBeInTheDocument();
  });

  it("keys only the roles the round used", () => {
    render(<CaseRead read={READ} sentences={SAID} length={58} />);
    expect(screen.getByText("the point")).toBeInTheDocument();
    expect(screen.getByText("an example")).toBeInTheDocument();
    expect(screen.queryByText("the close")).not.toBeInTheDocument();
  });

  it("says no point was made only when none was", () => {
    const missed: Sentence[] = SAID.map((sentence) => ({ ...sentence, role: "aside" }));
    render(<CaseRead read={{ ...READ, answered: "no" }} sentences={missed} length={58} />);
    expect(screen.getByText("no point made")).toBeInTheDocument();
  });

  it("accuses nobody of missing the point when the round made one and nothing timed it", () => {
    const untimed: Sentence[] = SAID.map((sentence) => ({ ...sentence, at: null, end: null }));
    render(<CaseRead read={READ} sentences={untimed} length={58} />);
    expect(screen.queryByText("no point made")).not.toBeInTheDocument();
    // The verdict and the advice still stand: they never needed a clock.
    expect(screen.getByText("Half answered.")).toBeInTheDocument();
  });
});

describe("the sample a free round sees", () => {
  it("says what Pro reads and links to it", () => {
    render(<SampleRead />);
    expect(screen.getByText("Pro reads what you said.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See Pro" })).toHaveAttribute("href", "/pro");
  });
});

describe("the case across rounds", () => {
  it("counts the rounds that answered and says which way the point moved", () => {
    render(<CaseCards rounds={SAMPLE_ROUNDS} />);
    expect(screen.getByText("Answered the topic")).toBeInTheDocument();
    expect(screen.getByText("4 of 10")).toBeInTheDocument();
    // Better and worse, never up and down: lower is better here.
    expect(screen.getByText(/better/)).toBeInTheDocument();
  });

  it("draws nothing at all until a round has been read", () => {
    const unread: Round[] = SAMPLE_ROUNDS.map((round) => ({ ...round, answered: null, point_at: null }));
    const { container } = render(<CaseCards rounds={unread} />);
    expect(container).toBeEmptyDOMElement();
  });
});
