import { backendFetch } from "@/lib/api";

/* The affiliate programme as the two pages read it. Every number here is
   the backend's: the rate, the window and the minimum are the constants
   settlement pays and the payouts tool refuses under, so no page can
   promise a figure the code does not honour. */
export type Programme = {
  percent: number;
  cookie_days: number;
  minimum_payout: string;
  /** This account's code, or null for a stranger reading the pitch. */
  code: string | null;
  link: string | null;
};

export type AffiliateEvent = {
  at: string;
  /** "signup", "purchase" or "refund". */
  kind: string;
  label: string;
  /** What it did to the balance, or "" for a signup, which does nothing. */
  amount: string;
};

export type AffiliatePayout = { at: string; amount: string; reference: string };

export type Referrals = {
  code: string;
  link: string;
  paypal_email: string;
  percent: number;
  minimum_payout: string;
  summary: {
    referrals: number;
    purchases: number;
    earned: string;
    paid: string;
    balance: string;
    payable: boolean;
  };
  activity: AffiliateEvent[];
  payouts: AffiliatePayout[];
};

const NO_PROGRAMME: Programme = {
  percent: 30,
  cookie_days: 60,
  minimum_payout: "$10.00",
  code: null,
  link: null,
};

/** The pitch's numbers, and this account's link when there is one. The
    fallback keeps the page drawing when the backend is unreachable; it is
    the same rate the code pays, since both come from one constant. */
export async function programme(): Promise<Programme> {
  try {
    const response = await backendFetch("/api/v1/affiliates");
    if (!response.ok) return NO_PROGRAMME;
    return (await response.json()) as Programme;
  } catch {
    return NO_PROGRAMME;
  }
}

/** One affiliate's own page, or null, which the page turns into the
    sign-in the proxy would have made. */
export async function referrals(): Promise<Referrals | null> {
  try {
    const response = await backendFetch("/api/v1/affiliates/referrals");
    if (!response.ok) return null;
    return (await response.json()) as Referrals;
  } catch {
    return null;
  }
}
