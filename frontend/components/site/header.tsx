import Link from "next/link";

import { AccountMenu } from "@/components/site/account-menu";
import { StreakPill } from "@/components/site/streak-pill";
import { Wordmark } from "@/components/site/wordmark";
import type { SessionUser } from "@/lib/api";

/* The band runs the full width of the page and carries the hairline; the
   row inside it is what stops at 80rem, so on a wide monitor the brand and
   the account mark stay a header rather than ending up a screen apart.
   Hidden while filming: the frame is a laptop screen shot from across the
   room, and everything that is not the topic and the clock gets out of
   the way. */
export function Header({ user, streak }: { user: SessionUser | null; streak: number }) {
  return (
    <header className="flex h-(--header-h) shrink-0 border-b border-accent px-[clamp(14px,4vw,28px)] py-2.5 filming:invisible">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:mx-auto md:max-w-[80rem]">
        <Link href="/" aria-label="impromptu.talk home" className="min-w-0 no-underline">
          <Wordmark collapse />
        </Link>
        <div className="flex items-center gap-1.5">
          <StreakPill days={streak} />
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}
