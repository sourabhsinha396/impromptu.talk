/* Where the visitor is, as far as anything here can honestly tell.

   Two callers ask, for two reasons: the pricing page, to preselect a
   currency, and the footer, to decide whether the "made in India" line is
   addressed to anybody. They ask the same question off the same three
   signals, so it is answered once here.

   Nothing here identifies anyone. A country and a timezone are facts about
   a connection, not about a person, and neither leaves this site. */

/* The eight markets the site prices in. A country outside them is no better
   an answer than none, because every caller is asking in order to do
   something per-market. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  DE: "EUR",
  GB: "GBP",
  IN: "INR",
  BR: "BRL",
  PH: "PHP",
  MX: "MXN",
  ZA: "ZAR",
};

/* The eurozone, plus the places that use the euro without being in it.
   Listed rather than matched on a `Europe/` prefix, because that prefix is
   wrong for London, Zurich, Oslo, Stockholm, Warsaw and a dozen more, and
   showing a Pole euros is a worse guess than showing them the base
   currency. */
const ZONES: Record<string, string[]> = {
  DE: [
    "Europe/Berlin", "Europe/Busingen", "Europe/Vienna", "Europe/Brussels",
    "Europe/Zagreb", "Europe/Nicosia", "Asia/Nicosia", "Europe/Tallinn",
    "Europe/Helsinki", "Europe/Paris", "Europe/Athens", "Europe/Dublin",
    "Europe/Rome", "Europe/Riga", "Europe/Vilnius", "Europe/Luxembourg",
    "Europe/Malta", "Europe/Amsterdam", "Europe/Lisbon", "Atlantic/Azores",
    "Atlantic/Madeira", "Europe/Bratislava", "Europe/Ljubljana",
    "Europe/Madrid", "Africa/Ceuta", "Atlantic/Canary", "Europe/Andorra",
    "Europe/Monaco", "Europe/San_Marino", "Europe/Vatican", "Europe/Podgorica",
  ],
  GB: ["Europe/London"],
  IN: ["Asia/Kolkata", "Asia/Calcutta"],
  BR: [
    "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife",
    "America/Belem", "America/Manaus", "America/Campo_Grande", "America/Cuiaba",
    "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco",
    "America/Eirunepe", "America/Santarem", "America/Maceio", "America/Araguaina",
    "America/Noronha",
  ],
  PH: ["Asia/Manila"],
  MX: [
    "America/Mexico_City", "America/Cancun", "America/Merida", "America/Monterrey",
    "America/Matamoros", "America/Chihuahua", "America/Ciudad_Juarez",
    "America/Ojinaga", "America/Mazatlan", "America/Bahia_Banderas",
    "America/Hermosillo", "America/Tijuana",
  ],
  ZA: ["Africa/Johannesburg"],
  US: [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Phoenix", "America/Anchorage", "America/Detroit",
    "America/Indiana/Indianapolis", "Pacific/Honolulu",
  ],
};

export const TIMEZONE_COUNTRY: Record<string, string> = Object.fromEntries(
  Object.entries(ZONES).flatMap(([country, zones]) => zones.map((zone) => [zone, country])),
);

export type Source = "country" | "timezone" | "language" | "default";

/** Which market a visitor is in, and which signal said so.

    Three signals, best first. A country header is a fact about where the
    request came from. A timezone is nearly one: `Asia/Kolkata` is a place,
    and the browser volunteers it. `Accept-Language` is the weak one: only
    its region subtag is read, because a language on its own says nothing
    about where somebody is spending money.

    The source is returned because it decides whether a page is willing to
    correct itself: `language` and `default` mean we had nothing to go on,
    and a timezone arriving a moment later is worth more than what was
    rendered. A signal naming a country with no market falls through to the
    next one rather than being believed. */
export function where(country: string | null | undefined, acceptLanguage = "", timezone = ""): [string, Source] {
  const named = country?.trim().toUpperCase() ?? "";
  if (named && named in COUNTRY_CURRENCY) return [named, "country"];

  const placed = TIMEZONE_COUNTRY[timezone.trim()];
  if (placed) return [placed, "timezone"];

  for (const tag of acceptLanguage.split(",")) {
    const parts = tag.split(";")[0].trim().replace(/_/g, "-").split("-");
    const region = parts[1]?.toUpperCase();
    if (region && region in COUNTRY_CURRENCY) return [region, "language"];
  }

  return ["", "default"];
}
