import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AboutRoute from "@/app/about/page";
import ContactRoute from "@/app/contact/page";
import RefundsRoute from "@/app/refunds/page";
import TermsRoute from "@/app/terms/page";

/* The terms read the affiliate rate from the backend rather than holding
   a copy, so the fake here hands back numbers nothing else on the page
   could have invented. */
vi.mock("@/lib/affiliates", () => ({
  programme: async () => ({
    percent: 25,
    cookie_days: 45,
    minimum_payout: "$20.00",
    code: null,
    link: null,
  }),
}));

describe("the refund policy", () => {
  it("leads with the window somebody came to read", () => {
    render(<RefundsRoute />);
    expect(screen.getByRole("heading", { name: "Seven days, no questions." })).toBeInTheDocument();
    expect(screen.getByText(/Ask within seven days of the payment and it is refunded in full/)).toBeInTheDocument();
  });

  it("says where a subscription is cancelled and what cancelling keeps", () => {
    render(<RefundsRoute />);
    expect(screen.getByText(/keeps the period already paid for/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "your account" }).length).toBeGreaterThan(0);
  });

  it("never says nothing renews, which was false for exactly the people it mattered to", () => {
    const { container } = render(<RefundsRoute />);
    /* v0's page carried that sentence beside one saying a subscription
       renews. Both cannot be true, and the one a subscriber believed was
       the wrong one. */
    expect(container.textContent).not.toMatch(/nothing renews/i);
    expect(container.textContent).toMatch(/A subscription renews until you cancel it/);
  });
});

describe("the terms", () => {
  it("prints the rate and the minimum the backend gives, never a typed copy", async () => {
    render(await TermsRoute());
    expect(screen.getByText(/25% of what that purchase paid us/)).toBeInTheDocument();
    expect(screen.getByText(/once a balance reaches/)).toBeInTheDocument();
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
  });
});

describe("about and contact", () => {
  it("says what the tool is and sends a reader into it", () => {
    render(<AboutRoute />);
    expect(screen.getByRole("heading", { name: "One topic you did not choose." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try a topic" })).toHaveAttribute("href", "/");
  });

  it("gives one inbox and no form, which is the whole decision on that page", () => {
    const { container } = render(<ContactRoute />);
    expect(screen.getByRole("link", { name: "hello@impromptu.talk" })).toHaveAttribute(
      "href",
      "mailto:hello@impromptu.talk",
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });
});
