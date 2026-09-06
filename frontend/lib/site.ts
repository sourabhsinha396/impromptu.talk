/**
 * Who the site says it is, in one place, so a domain change is a one-line
 * diff rather than a sweep.
 *
 * Metadata, JSON-LD and the sitemap all have to agree about the name, the
 * description and the origin. Three copies of that drift, and the one that
 * drifts is always the one a crawler reads rather than the one a person does.
 *
 * The origin is env because it is an address, which is the only thing
 * besides a secret that env holds here. The copy below is a product decision
 * and stays in code.
 */

export const SITE_NAME = "impromptu.talk";

export const SITE_TAGLINE = "A random topic. A minute to think. A minute to talk.";

export const SITE_DESCRIPTION =
  "Get a random topic. A minute to think. A minute to talk. Free impromptu speaking practice, no account, nothing to install.";

/* No trailing slash, because everything here appends one. The default is
   the dev port rather than a domain: a wrong domain baked in as a fallback
   would be published by a host that simply forgot to set the variable. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3009").replace(/\/$/, "");

/** A site path or an absolute URL, as an address a crawler can follow. */
export function absolute(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
