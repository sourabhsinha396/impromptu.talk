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

/* Who owns the site, as opposed to what it is called. The two are different
   words on purpose: the site name is the product a visitor came for, and
   this is the name beside the copyright that would be read out in a
   dispute. Empty falls back to the site name, which is the honest answer
   for anyone running this from a checkout: there is no company behind it
   yet. Both are env because they are identity and an address. */
export const OWNER = process.env.NEXT_PUBLIC_COMPANY_NAME || SITE_NAME;

/* The one address anyone is invited to write to: the contact page, the
   legal documents and the footer of every page. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "hello@impromptu.talk";
