/* Where to land after signing in. A `?next=` crosses the sign-in
   boundary, so it is treated as an untrusted URL even though it came out
   of this site's own query string: "//evil.example" is a path a browser
   is happy to treat as another origin. Our own paths only, and the tool
   when nothing asked for anywhere. */

const ORIGIN = "http://impromptu.invalid";

export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** The other door, carrying the same continuation. */
export function authHref(path: "/login" | "/signup", next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
