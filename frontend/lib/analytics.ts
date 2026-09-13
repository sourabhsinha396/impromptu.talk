/* Analytics, as the page sees them. `track` always exists and is safe to
   call with nothing configured, which is the normal state in a checkout,
   so the round behaves identically either way. */

export const POSTHOG_HOST = "https://us.i.posthog.com";

export type AnalyticsConfig = { token: string; host: string };

/** On when the frontend's `.env` says `DEBUG_ENV=production` and holds a
    token; either alone sends nothing. The switch is an env value rather
    than the build mode, so a production build run on a laptop to measure
    weight is not traffic, and flipping one line is how a developer watches
    their own events arrive. Resolved on the server and handed to the
    browser as props.

    Off as well for an operator's own browser: the owner signs in on the
    live site to look around, and those visits are not a visitor's. It
    reads `is_superuser`, the flag the chrome already carries, and nothing
    on the site raises that flag, so only the admin can put a browser in
    this state. The decision is per request rather than per deploy because
    it is the person, not the build, that makes the difference. */
export function analyticsConfig(
  user: { is_superuser: boolean } | null,
  env: Record<string, string | undefined> = process.env,
): AnalyticsConfig | null {
  if (user?.is_superuser) return null;
  const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (env.DEBUG_ENV !== "production" || !token) return null;
  return { token, host: env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_HOST };
}

export type Props = Record<string, unknown>;
type Sink = (name: string, props: Props) => void;

/* Events fired before the library lands are held rather than dropped: a
   visitor can spin inside two seconds, and that is the event that matters
   most. Bounded, because with analytics off nothing ever drains it. */
const PENDING_MAX = 50;
const pending: [string, Props][] = [];
let sink: Sink | null = null;

export function track(name: string, props: Props = {}): void {
  if (sink) {
    try {
      sink(name, props);
    } catch {
      /* Analytics never break the page. */
    }
    return;
  }
  if (pending.length < PENDING_MAX) pending.push([name, props]);
}

/** Where events go from now on; the ones waiting go there first, in order.
    Null detaches, and events queue again. */
export function attach(next: Sink | null): void {
  sink = next;
  if (next) for (const [name, props] of pending.splice(0)) track(name, props);
}
