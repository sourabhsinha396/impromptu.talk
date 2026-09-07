/* The cookies the site sets, by name, so the proxy, the layout and the
   tests agree on them. The backend owns the session and device cookies
   and this file only knows their names. The referral and timezone
   cookies are written on this side, because a link lands on a page and
   only the browser knows its own clock. */

export const SESSION_COOKIE = "impromptu_session";
export const REFERRAL_COOKIE = "impromptu_ref";
export const TIMEZONE_COOKIE = "impromptu_tz";
/* A currency somebody picked, which is a different thing from one we
   guessed. Only a pick is remembered: a guess that wrote itself down
   would harden a wrong one into a preference nobody chose, and the
   ladder can guess again on every request for free. */
export const CURRENCY_COOKIE = "impromptu_currency";

/* Sixty days: somebody who read a post, tried the free round for a few
   weeks and then bought is still credited to the person who sent them,
   which is the case an affiliate is actually promised. */
export const REFERRAL_MAX_AGE = 60 * 60 * 24 * 60;

/* What a code may look like: lowercase letters and digits, nothing else.
   It is read out of a URL and goes into a Set-Cookie header, so the shape
   is the whole of what is trusted here. Whether the code exists is decided
   by the backend at the two moments it is spent, signing up and opening a
   checkout, not on every page load. */
const REFERRAL_CODE = /^[a-z0-9]{2,24}$/;

/** The code in a `?ref=` value, or "" for anything that is not one. */
export function referralCode(value: string | null | undefined): string {
  if (!value) return "";
  const code = value.trim().toLowerCase();
  return REFERRAL_CODE.test(code) ? code : "";
}

/* Runs inline before first paint. Only the browser knows its own timezone,
   and Asia/Kolkata is a far better answer to "which currency" than
   Accept-Language, which is a language and not a place. Written on every
   page rather than on the pricing page alone, so it is already there by
   the time anybody gets there. Percent-encoded because a cookie value may
   not carry a bare slash; the backend decodes. It is a place name, not an
   identifier, and it never leaves this site. */
export const timezoneInit =
  `try{if(document.cookie.indexOf("${TIMEZONE_COOKIE}=")<0){` +
  `var z=Intl.DateTimeFormat().resolvedOptions().timeZone;` +
  `if(z)document.cookie="${TIMEZONE_COOKIE}="+encodeURIComponent(z)+";path=/;max-age=15552000;samesite=lax"}}catch(e){}`;

/* A year: long enough that somebody who picked their currency once is
   still shown it when they come back to buy. */
export const CURRENCY_MAX_AGE = 60 * 60 * 24 * 365;

export const DEVICE_COOKIE = "impromptu_device";

/* The backend signs the device cookie as `id:timestamp:signature` and is
   the only side that verifies it. The id in front is read here for one
   purpose: telling analytics which device this is, so a return rate read
   from PostHog and one read from the sessions table describe the same
   people. Nothing else on this side trusts it. A forged or expired value is
   answered by the backend with a fresh id on the next API response, and the
   next page load identifies with that one instead; anything that is not
   the shape of an id is treated as no cookie at all. */
export function deviceIdFrom(signed: string | undefined): string {
  const id = signed?.split(":")[0] ?? "";
  return /^[0-9a-f]{32}$/.test(id) ? id : "";
}
