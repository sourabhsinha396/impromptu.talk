import { cookies, headers } from "next/headers";

import { CURRENCY_COOKIE, TIMEZONE_COOKIE } from "@/lib/cookies";
import { currencyCode, currencyFor, where } from "@/lib/geo";

/** ISO 3166 alpha-2 for the visitor, or "" when nothing places them.
    Server only: it reads the request.

    `CF-IPCountry` is read on every request. The site sits behind
    Cloudflare, which sets it, and where something else is in front the
    header is visitor-supplied and both consequences are harmless: the
    wrong currency in a picker they can change anyway, and a line of ours
    in the footer. It was behind an env switch until the proxy was
    settled; a flag with one true setting is a flag somebody forgets to
    set, and the first rung of the ladder is what makes the answer right
    on the first request, before the timezone cookie exists. */
export async function visitorCountry(): Promise<string> {
  const [sent, jar] = await Promise.all([headers(), cookies()]);
  const country = sent.get("cf-ipcountry");
  /* A cookie value may not carry a bare slash, so the script percent-encodes
     the zone and `Asia/Kolkata` arrives as `Asia%2FKolkata`. Undone here,
     because an encoded zone matches no entry in the table and would fail as
     a silent fall-through to the weakest signal. */
  const timezone = decodeURIComponent(jar.get(TIMEZONE_COOKIE)?.value ?? "");
  const [place] = where(country, sent.get("accept-language") ?? "", timezone);
  return place;
}

/** The currency to quote this visitor in.

    The whole ladder, top rung first: a currency they picked, then the
    country any signal places them in, then the base currency. A guess is
    never written down, only a pick, so somebody who was quoted rupees on
    a guess and travels is quoted afresh rather than in a currency nobody
    chose. Server only: it reads the request. */
export async function visitorCurrency(): Promise<string> {
  const [jar, country] = await Promise.all([cookies(), visitorCountry()]);
  return currencyCode(jar.get(CURRENCY_COOKIE)?.value) || currencyFor(country);
}
