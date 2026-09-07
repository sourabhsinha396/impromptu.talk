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
export type SessionUser = { email: string; name: string; is_superuser: boolean; accent: string; is_pro?: boolean };

/** Everything the two settings pages draw, in one call. Null when the
    backend is unreachable or the session has gone, which the page turns
    into the sign-in redirect the proxy would have made. */
export type AccountSettings = {
  email: string;
  name: string;
  accent: string;
  has_password: boolean;
  share_token: string | null;
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
