import { cookies } from "next/headers";

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
export type SessionUser = { email: string; name: string; is_superuser: boolean; is_pro?: boolean };

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
