import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferralsPage } from "@/components/affiliates/referrals";
import type { Referrals } from "@/lib/affiliates";

const PAGE: Referrals = {
  code: "priya",
  link: "https://yapholic.com?ref=priya",
  paypal_email: "priya@paypal.com",
  percent: 30,
  minimum_payout: "$10.00",
  summary: {
    referrals: 12,
    purchases: 3,
    earned: "$31.10",
    paid: "$5.00",
    balance: "$26.10",
    payable: true,
  },
  activity: [
    { at: "2026-09-07T10:00:00+00:00", kind: "purchase", label: "Lifetime bought", amount: "$11.70" },
    { at: "2026-09-06T10:00:00+00:00", kind: "signup", label: "New account", amount: "" },
    { at: "2026-09-04T10:00:00+00:00", kind: "refund", label: "30 day pass, refunded", amount: "-$2.70" },
  ],
  payouts: [{ at: "2026-09-01T10:00:00+00:00", amount: "$5.00", reference: "8KQ21P" }],
};

const EMPTY: Referrals = {
  ...PAGE,
  paypal_email: "",
  summary: { referrals: 0, purchases: 0, earned: "$0.00", paid: "$0.00", balance: "$0.00", payable: false },
  activity: [],
  payouts: [],
};

describe("the referrals page", () => {
  it("says what a purchase added and what a refund took back", () => {
    render(<ReferralsPage page={PAGE} />);
    expect(screen.getByText("+$11.70")).toBeInTheDocument();
    /* A refund is its own line rather than the sale quietly vanishing
       from the list, and it reads as the subtraction it is. */
    expect(screen.getByText("-$2.70")).toBeInTheDocument();
    expect(screen.getByText("30 day pass, refunded")).toBeInTheDocument();
  });

  it("names nobody, because the people on the list did not sign up to be reported on", () => {
    const { container } = render(<ReferralsPage page={PAGE} />);
    expect(screen.getByText("New account")).toBeInTheDocument();
    expect(container.textContent).not.toContain("@example.com");
  });

  it("reads the rate and the minimum off the payload rather than holding its own copy", () => {
    render(<ReferralsPage page={{ ...PAGE, percent: 25, minimum_payout: "$20.00" }} />);
    expect(screen.getByText(/keep 25%/)).toBeInTheDocument();
    expect(screen.getByText(/over \$20\.00/)).toBeInTheDocument();
  });

  it("shows three tiles and the same three whatever the numbers are", () => {
    /* Never two and one: the tiles are a row that has to stay a row. */
    render(<ReferralsPage page={EMPTY} />);
    for (const label of ["People", "Bought", "Balance"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("keeps Save off until the address changes", async () => {
    render(<ReferralsPage page={PAGE} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
