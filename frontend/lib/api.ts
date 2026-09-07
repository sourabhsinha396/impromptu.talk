import { cookies } from "next/headers";

import { EMPTY_HISTORY, type History, type Shared } from "@/lib/practice";

export const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8009";

/* Server components call the backend origin directly (the rewrite is for
   the browser) and forward the incoming cookies so the session holds. */
export async function backendFetch(path: string, init: RequestInit = {}) {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  return fetch(`${BACKEND_ORIGIN}${path}`, {
    ...init,
    headers: { ...init.headers, ...(cookieHeader ? { cookie: cookieHeader } : {}) },
    cache: "no-store",
  });
}

/* `is_pro` arrives with the entitlement card; until then it is absent, and
   absent reads as not Pro, which is true of every account today. */
export type SessionUser = {
  email: string;
  name: string;
  is_superuser: boolean;
  accent: string;
  /* Whether Pro's features are open to this account. True for everybody
     while nothing is for sale, which is also what keeps "Get Pro" out of
     the menu while there is no page to send anybody to. */
  is_pro: boolean;
};

/** One plan, as an account page names it. What a plan is called is
    product policy, so the backend says it rather than the frontend
    keeping a second copy of the catalogue. */
export type Plan = {
  code: string;
  name: string;
  recurring: boolean;
  note: string;
  expires_at: string | null;
  /** Its own field: a cancelled subscription stays active until the paid period ends. */
  cancels: boolean;
};

/** Everything the two settings pages draw, in one call. Null when the
    backend is unreachable or the session has gone, which the page turns
    into the sign-in redirect the proxy would have made. */
export type AccountSettings = {
  email: string;
  name: string;
  accent: string;
  has_password: boolean;
  share_token: string | null;
  is_pro: boolean;
  /** The plan granting Pro, or null when nothing is held. */
  plan: Plan | null;
};

export async function accountSettings(): Promise<AccountSettings | null> {
  try {
    const response = await backendFetch("/api/v1/auth/account");
    if (!response.ok) return null;
    return (await response.json()) as AccountSettings;
  } catch {
    return null;
  }
}

/** The account behind the session, or null for a stranger. Null too when
    the backend is unreachable: the page still renders, in its signed-out
    shape, rather than failing on the one call every page makes. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    const response = await backendFetch("/api/v1/auth/me");
    if (!response.ok) return null;
    return (await response.json()) as SessionUser;
  } catch {
    return null;
  }
}

export type StreakSummary = { streak: number; topics: number; minutes: number };

/** The streak, topics and minutes for the header pill, the same numbers
    the round is told when it records. Zeros when the backend is
    unreachable, which is what a stranger sees anyway. Today is the
    timezone cookie's day, read by the backend off the forwarded cookies. */
export async function streakSummary(): Promise<StreakSummary> {
  try {
    const response = await backendFetch("/api/v1/runs/summary");
    if (!response.ok) return { streak: 0, topics: 0, minutes: 0 };
    return (await response.json()) as StreakSummary;
  } catch {
    return { streak: 0, topics: 0, minutes: 0 };
  }
}

/** Everything the streak page shows, in one call, for the device and
    account behind the forwarded cookies. Empty when the backend is
    unreachable, which draws the page's "Nothing yet." state rather than
    failing the one page a person came to look at. */
export async function practiceHistory(): Promise<History> {
  try {
    const response = await backendFetch("/api/v1/runs/history");
    if (!response.ok) return EMPTY_HISTORY;
    return (await response.json()) as History;
  } catch {
    return EMPTY_HISTORY;
  }
}

/** One person's shared practice, or null for a token nobody holds, which
    the page turns into a 404. Public: no cookie decides what it shows. */
export async function sharedPractice(token: string): Promise<Shared | null> {
  try {
    const response = await backendFetch(`/api/v1/runs/shared/${encodeURIComponent(token)}`);
    if (!response.ok) return null;
    return (await response.json()) as Shared;
  } catch {
    return null;
  }
}

/** Whether a reset link still opens, so the page shows the form or the
    sentence before anybody types into a dead one. Dead when the backend
    is unreachable, which prints the sentence with the way to ask again. */
export async function resetLinkLive(token: string): Promise<boolean> {
  try {
    const response = await backendFetch(`/api/v1/auth/reset/${encodeURIComponent(token)}`);
    return response.ok;
  } catch {
    return false;
  }
}

/* The pricing page, priced by the backend. The page prints what it is
   handed and does no arithmetic: the table, the multipliers and the
   rounding are product policy and live on one side of the wire. */
export type Market = { currency: string; country: string; name: string };
export type PricedPlan = {
  code: string;
  name: string;
  unit: string;
  note: string;
  recurring: boolean;
  price: string;
  amount_minor: number;
  tracks: number;
  refusal: string;
};
export type Card = { kind: string; title: string; plans: PricedPlan[] };
export type Catalogue = {
  selling: boolean;
  /** "test" or "live", the word the checkout dialog wants. */
  mode: string;
  currency: string;
  currencies: Market[];
  cards: Card[];
  free_days: number;
};

const NOTHING_FOR_SALE: Catalogue = {
  selling: false,
  mode: "test",
  currency: "USD",
  currencies: [],
  cards: [],
  free_days: 5,
};

/** What Pro costs this visitor. A backend that is not answering reads as
    nothing for sale, which draws the page saying so rather than failing
    the one page somebody came to read a price on. */
export async function catalogue(currency: string): Promise<Catalogue> {
  try {
    const response = await backendFetch(`/api/v1/payments/plans?currency=${encodeURIComponent(currency)}`);
    if (!response.ok) return NOTHING_FOR_SALE;
    return (await response.json()) as Catalogue;
  } catch {
    return NOTHING_FOR_SALE;
  }
}

export type Receipt = {
  reference: string;
  plan_name: string;
  recurring: boolean;
  status: string;
  charged: string;
  expires_at: string | null;
};

/** Settle a purchase and read it back. Idempotent: a settled row
    short-circuits, so a reload re-grants nothing. Null when the reference
    is not this account's, which the page turns into a 404. */
export async function settlePurchase(reference: string, paymentId: string, subscriptionId: string) {
  try {
    const response = await backendFetch("/api/v1/payments/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, payment_id: paymentId, subscription_id: subscriptionId }),
    });
    if (!response.ok) return null;
    return (await response.json()) as Receipt;
  } catch {
    return null;
  }
}

/** Re-read whatever subscription has run out. Called on the way back
    from the provider's portal, and nowhere else. */
export async function refreshEntitlement(): Promise<void> {
  try {
    await backendFetch("/api/v1/payments/refresh", { method: "POST" });
  } catch {
    // A provider having a day is not a page that fails to render.
  }
}
