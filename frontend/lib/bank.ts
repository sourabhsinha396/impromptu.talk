import { BACKEND_ORIGIN } from "@/lib/api";

/* The bank as the page receives it: the built-in genres in picker order,
   every active topic, and the styles for the select. One shape for the
   picker, the reel and the style select. */
export type Genre = { slug: string; name: string; icon: string; blurb: string; own?: boolean };
export type Topic = { text: string; genre: string; style: string; slug: string };
export type Style = { key: string; label: string; hint: string };
export type Bank = { genres: Genre[]; topics: Topic[]; styles: Style[] };

export const EMPTY_BANK: Bank = { genres: [], topics: [], styles: [] };

/** The whole built-in bank, fetched on the server with no cookies and kept
    for an hour, so a respin costs no round trip and a visit costs the
    backend nothing most of the time. The page never fails on this call:
    an unreachable backend yields an empty bank and the tool still draws. */
export async function fetchBank(): Promise<Bank> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/v1/topics/bank`, { next: { revalidate: 3600 } });
    if (!response.ok) return EMPTY_BANK;
    return (await response.json()) as Bank;
  } catch {
    return EMPTY_BANK;
  }
}
