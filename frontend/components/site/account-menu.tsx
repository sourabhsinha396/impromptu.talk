"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AccountIcon } from "@/components/site/icons";
import { ThemeSegment } from "@/components/site/theme-segment";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/api";

/* Everything an account needs lives behind this one icon, so the front door
   stays one button. The menu holds destinations, not features: pages a
   person goes to, never toggles for things the round does.

   Built on the shadcn primitive copied in byte for byte, so every adaptation
   is a class passed from here. The registry paints a focused item
   `bg-accent`, which in its token set is a quiet grey and in ours is the
   colour of the topic; the hover here is the surface and the strong accent
   on the text, as v0 drew it. */
const ITEM =
  "cursor-pointer rounded-[10px] px-3 py-[9px] text-sm text-ink focus:bg-card2 focus:text-accent-strong data-[highlighted]:bg-card2 data-[highlighted]:text-accent-strong";

function Item({ href, children }: { href: string; children: ReactNode }) {
  return (
    <DropdownMenuItem asChild className={ITEM}>
      <Link href={href}>{children}</Link>
    </DropdownMenuItem>
  );
}

export function AccountMenu({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  async function signOut() {
    const response = await fetch("/api/v1/auth/logout", { method: "POST" });
    if (!response.ok) return;
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        title="Account"
        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card2 text-muted transition-colors hover:border-accent hover:text-ink aria-expanded:text-ink"
      >
        <AccountIcon size={18} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[232px] rounded-card border-line bg-card p-1.5 text-ink">
        {user ? (
          <>
            {/* The name if they gave one; the email is what older accounts
                have. Not an item: nothing happens when it is pressed. */}
            <p className="px-3 pt-1 pb-1.5 text-[13px] font-semibold text-muted [overflow-wrap:anywhere]">
              {user.name || user.email}
            </p>
            <Item href="/account">Settings</Item>
            <Item href="/affiliate">Affiliates</Item>
            {/* The one link here that not every account has. It is a page,
                which is what the menu holds, and it is invisible to everybody
                but the handful of rows carrying the flag. */}
            {user.is_superuser && <Item href="/administration">Administration</Item>}
            {/* A page that forgets to ask would quietly sell Pro to somebody
                who has it. */}
            {!user.is_pro && <Item href="/pro">Get Pro</Item>}
            <DropdownMenuItem onSelect={signOut} className={ITEM}>
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <Item href="/signup">Create an account</Item>
            <Item href="/login">Sign in</Item>
            <Item href="/pro">Pro</Item>
            <Item href="/affiliate">Affiliates</Item>
          </>
        )}

        {/* Theme lives here rather than in its own header button: it is a
            preference, set once, and the header is for the things you touch
            every round. */}
        <div className="mt-1 border-t border-line px-3 pt-2 pb-2.5">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Theme</span>
          <ThemeSegment />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
