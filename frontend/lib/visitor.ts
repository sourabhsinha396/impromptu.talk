import { cookies, headers } from "next/headers";

import { TIMEZONE_COOKIE } from "@/lib/cookies";
import { where } from "@/lib/geo";

/* The country header is read only where a proxy sets it. Anywhere else it
   is visitor-supplied, and both consequences are harmless (the wrong price
   in a picker they can change, and a line of ours in the footer), which is
   why this is a switch that defaults to off rather than a hard gate. It is
   the first rung of the ladder, so turning it on is also what lets both
   answers be right on the first request: the timezone below it arrives in
   a cookie a script writes after first paint. */
const TRUST_COUNTRY_HEADER = process.env.TRUST_COUNTRY_HEADER === "1";

/** ISO 3166 alpha-2 for the visitor, or "" when nothing places them.
    Server only: it reads the request. */
export async function visitorCountry(): Promise<string> {
  const [sent, jar] = await Promise.all([headers(), cookies()]);
  const country = TRUST_COUNTRY_HEADER ? sent.get("cf-ipcountry") : null;
  /* A cookie value may not carry a bare slash, so the script percent-encodes
     the zone and `Asia/Kolkata` arrives as `Asia%2FKolkata`. Undone here,
     because an encoded zone matches no entry in the table and would fail as
     a silent fall-through to the weakest signal. */
  const timezone = decodeURIComponent(jar.get(TIMEZONE_COOKIE)?.value ?? "");
  const [place] = where(country, sent.get("accept-language") ?? "", timezone);
  return place;
}
