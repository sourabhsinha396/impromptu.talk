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
  it("is titled plainly and states the window in its first rule", () => {
    /* The page is a document somebody arrives at to check a fact, so the
       heading is the document's name and the fact is the first line of
       the section, not a line of voice above it. */
    render(<RefundsRoute />);
    expect(screen.getByRole("heading", { level: 1, name: "Refund Policy" })).toBeInTheDocument();
    expect(screen.getByText(/within seven days of a payment and it is refunded in full/)).toBeInTheDocument();
  });

  it("says where a subscription is cancelled and what cancelling keeps", () => {
    render(<RefundsRoute />);
    expect(screen.getByText(/keeps the period already paid for/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "your account" }).length).toBeGreaterThan(0);
  });

  it("never says nothing renews, and does not explain the product it is about", () => {
    const { container } = render(<RefundsRoute />);
    /* v0's page carried that sentence beside one saying a subscription
       renews. Both cannot be true, and the one a subscriber believed was
       the wrong one. What replaced it is not a description of the plans:
       that is the pricing page's job (owner's call). */
    expect(container.textContent).not.toMatch(/nothing renews/i);
    expect(container.textContent).not.toMatch(/free/i);
  });
});

describe("the terms", () => {
  it("prints the rate and the minimum the backend gives, never a typed copy", async () => {
    render(await TermsRoute());
    const affiliates = screen.getByRole("heading", { name: /Affiliate programme/ }).nextElementSibling;
    expect(affiliates?.textContent).toContain("25% of the amount that purchase paid us");
    expect(affiliates?.textContent).toContain("$20.00");
  });
});

describe("about and contact", () => {
  it("says what the tool is and sends a reader into it", () => {
    render(<AboutRoute />);
    expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try a topic" })).toHaveAttribute("href", "/");
  });

  it("gives one address and no form, which is the whole decision on that page", () => {
    const { container } = render(<ContactRoute />);
    expect(screen.getByRole("link", { name: "hello@yapholic.com" })).toHaveAttribute(
      "href",
      "mailto:hello@yapholic.com",
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });
});

describe("the written pages", () => {
  it("are titled as the documents they are, with no line of voice over the answer", async () => {
    /* Owner's call, 2026-09-07: "Almost nothing." and "The short version."
       are not what somebody checking a fact came to read. */
    for (const [route, name] of [
      [<RefundsRoute key="r" />, "Refund Policy"],
      [<AboutRoute key="a" />, "About"],
      [<ContactRoute key="c" />, "Contact"],
    ] as const) {
      const { unmount } = render(route);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(name);
      unmount();
    }
    const { unmount } = render(await TermsRoute());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms and Conditions");
    unmount();
  });
});
