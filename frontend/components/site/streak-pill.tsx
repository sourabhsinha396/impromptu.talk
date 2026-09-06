import Link from "next/link";

import { FlameIcon } from "@/components/site/icons";

/* A flame and a number, and nothing else. The words "day streak" were the
   widest thing in the header and said nothing the pair does not; they live
   on in the title and the aria-label, where the full sentence costs no
   space. Absent until there is a streak, and the only door to /streak. */
export function StreakPill({ days }: { days: number }) {
  if (days < 1) return null;
  const sentence = `${days} day streak`;
  return (
    <Link
      href="/streak"
      title={sentence}
      aria-label={sentence}
      className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-card2 py-[5px] pr-[11px] pl-[9px] text-[13.5px] font-semibold text-ink"
    >
      <FlameIcon size={15} className="shrink-0 text-accent" />
      <b className="font-bold text-accent">{days}</b>
    </Link>
  );
}
