import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { forget, initialize, openDialog } from "@/components/pro/overlay";
import { Plans } from "@/components/pro/plans";
import type { Catalogue, PricedPlan } from "@/lib/api";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

function plan(over: Partial<PricedPlan> & { code: string; name: string }): PricedPlan {
  return {
    unit: "once",
    note: "",
    recurring: false,
    price: "$39",
    amount_minor: 3900,
    tracks: 365,
    refusal: "",
    ...over,
  };
}

const CATALOGUE: Catalogue = {
  selling: true,
  mode: "test",
  currency: "USD",
  currencies: [
    { currency: "USD", country: "US", name: "United States" },
    { currency: "INR", country: "IN", name: "India" },
  ],
  cards: [
    {
      kind: "sub",
      title: "Subscription",
      plans: [
        plan({ code: "monthly", name: "Monthly", unit: "/month", price: "$5", recurring: true, tracks: 30 }),
        plan({ code: "annual", name: "Annual", unit: "/year", price: "$29", recurring: true, tracks: 365 }),
      ],
    },
    {
      kind: "one",
      title: "One-time",
      plans: [
        plan({ code: "pass", name: "30 day pass", price: "$8", tracks: 30 }),
        plan({ code: "lifetime", name: "Lifetime", price: "$39", tracks: 365 }),
      ],
    },
  ],
  free_days: 5,
};

function shut(): Catalogue {
  return { ...CATALOGUE, selling: false, cards: CATALOGUE.cards.map((card) => ({ ...card, plans: [] })) };
}

describe("the plans", () => {
  it("opens on the first plan of the first card, with its own numbers under it", () => {
    render(<Plans catalogue={CATALOGUE} signedIn />);
    expect(screen.getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
    // The list belongs to the picked plan: a month tracks a month.
    expect(screen.getByText("30 days of streak, instead of 5")).toBeInTheDocument();
    expect(screen.getByText("30 days of history")).toBeInTheDocument();
  });

  it("changes the list when a longer plan is picked, and only the lines that differ", async () => {
    render(<Plans catalogue={CATALOGUE} signedIn />);
    await userEvent.click(screen.getByRole("radio", { name: "Lifetime" }));
    expect(screen.getByText("A year of streak, instead of 5")).toBeInTheDocument();
    expect(screen.getByText("A year of history")).toBeInTheDocument();
    // The four that are the same on every plan are said once, whatever is
    // picked, which is the reason this list is not printed inside each card.
    expect(screen.getByText("Your pick of six colours")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in and back rather than to a checkout", () => {
    render(<Plans catalogue={CATALOGUE} signedIn={false} />);
    expect(screen.getByRole("link", { name: "Subscribe for $5" })).toHaveAttribute("href", "/login?next=%2Fpro");
  });

  it("names the price on the button, so what is pressed says what it costs", async () => {
    render(<Plans catalogue={CATALOGUE} signedIn />);
    expect(screen.getByRole("button", { name: "Subscribe for $5" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Annual" }));
    expect(screen.getByRole("button", { name: "Subscribe for $29" })).toBeInTheDocument();
  });

  it("prints the refusal in place of the button, so a card says what is already held", () => {
    const held = {
      ...CATALOGUE,
      cards: CATALOGUE.cards.map((card) => ({
        ...card,
        plans: card.plans.map((one) => ({ ...one, refusal: "this account already has Pro for life" })),
      })),
    };
    render(<Plans catalogue={held} signedIn />);
    expect(screen.getAllByText("this account already has Pro for life")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Subscribe/ })).not.toBeInTheDocument();
  });

  it("says a card is not open rather than going quiet", () => {
    render(<Plans catalogue={shut()} signedIn />);
    expect(screen.getAllByText("Not open yet. Come back shortly.")).toHaveLength(2);
    // Nothing to pick, so nothing claims to get you anything.
    expect(screen.queryByText(/What you get with/)).not.toBeInTheDocument();
  });

  it("asks our own route for a checkout, naming the plan and the currency on screen", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Not open yet." }), { status: 400 }));
    vi.stubGlobal("fetch", sent);
    render(<Plans catalogue={CATALOGUE} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: "Subscribe for $5" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/payments/checkout", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({ plan: "monthly", currency: "USD" });
    expect(screen.getByRole("alert")).toHaveTextContent("Not open yet.");
  });

  it("leaves for the checkout it is handed when there is no dialog to open", async () => {
    const url = "https://test.checkout.dodopayments.com/session/cks_1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ url }), { status: 200 })));
    const location = { href: "" };
    vi.stubGlobal("location", location);
    render(<Plans catalogue={CATALOGUE} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: "Subscribe for $5" }));
    expect(location.href).toBe(url);
    expect(push).not.toHaveBeenCalled();
  });

  it("carries a picked currency into the URL, which is what the proxy remembers", async () => {
    render(<Plans catalogue={CATALOGUE} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: "Currency" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "INR" }));
    expect(push).toHaveBeenCalledWith("/pro?currency=INR");
  });
});

describe("the checkout dialog", () => {
  afterEach(() => forget());

  it("opens over the page once the SDK is up", () => {
    const open = vi.fn();
    vi.stubGlobal("DodoPaymentsCheckout", { DodoPayments: { Initialize: vi.fn(), Checkout: { open } } });
    expect(initialize("test")).toBe(true);
    expect(openDialog("https://checkout/1")).toBe(true);
    expect(open).toHaveBeenCalledWith({ checkoutUrl: "https://checkout/1" });
  });

  it("says no when the script never arrived, so the caller navigates instead", () => {
    // A blocked CDN, an ad blocker, a browser that refused it: the page
    // is exactly the page it was before, and the button still buys Pro.
    expect(initialize("test")).toBe(false);
    expect(openDialog("https://checkout/1")).toBe(false);
  });

  it("says no when the SDK throws rather than leaving the button dead", () => {
    const thrower = () => {
      throw new Error("no");
    };
    vi.stubGlobal("DodoPaymentsCheckout", { DodoPayments: { Initialize: thrower, Checkout: { open: thrower } } });
    expect(initialize("test")).toBe(false);
    expect(openDialog("https://checkout/1")).toBe(false);
  });
});
