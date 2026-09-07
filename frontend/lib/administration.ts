import { backendFetch } from "@/lib/api";

/* The operator's four tools. Every route behind these answers 404 to
   anybody who is not a superuser, signed out or not, so a null here means
   "not yours" and the page turns it into the same 404. */
export type Gift = {
  id: number;
  email: string;
  name: string;
  plan: string;
  at: string;
  /** Null is forever, which is the one thing a date cannot say. */
  until: string | null;
};
export type Pro = { lengths: { code: string; label: string }[]; gifts: Gift[] };

export type Owed = {
  user_id: number;
  email: string;
  name: string;
  paypal_email: string;
  balance: string;
  earned: string;
  /** Over the minimum and with somewhere to send it. */
  ready: boolean;
};
export type Paid = { at: string; email: string; amount: string; reference: string };
export type Payouts = { minimum: string; owed: Owed[]; recent: Paid[] };

export type OutreachRow = { id: number; name: string; url: string; at: string };
export type Outreach = { message: string; rows: OutreachRow[] };

async function tool<T>(path: string): Promise<T | null> {
  try {
    const response = await backendFetch(path);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const proTool = () => tool<Pro>("/api/v1/administration/pro");
export const payoutsTool = () => tool<Payouts>("/api/v1/administration/payouts");
export const outreachTool = () => tool<Outreach>("/api/v1/administration/outreach");
