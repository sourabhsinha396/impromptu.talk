import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

/* The one button. Ours rather than shadcn's: its outline and ghost variants
   hover to `bg-accent`, which in shadcn's token set is a quiet grey surface
   and in ours is the colour of the topic, so a byte-identical copy would
   fill every ghost button with the brand colour on hover.

   Primary is ink, never the accent. The accent belongs to the topic, and a
   colour that is on the biggest thing on screen cannot also be what marks
   the smallest one as pressable. It is the one control whose colour never
   moves: not between idle and mid-round, and not when somebody picks a
   different accent. lib/palette.test.ts pins this. */

type Variant = "primary" | "ghost";
type Size = "sm" | "md" | "xl" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-btn text-btn-ink hover:bg-btn-strong disabled:hover:bg-btn",
  /* `line-strong`, not `line`: the hairline between list rows gives 1.3:1
     against the page, a border nobody can see, and a control has to look
     pressable. */
  ghost: "border-line-strong text-muted hover:bg-card2 hover:text-ink",
};

/* Three sizes and a square. xl is the round's own button, wide enough to
   be the obvious thing on a screen filmed from across a room. */
const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[13.5px]",
  md: "px-6 py-3 text-base",
  xl: "px-[46px] py-[17px] text-lg",
  icon: "p-3",
};

/* A press moves the control down a pixel, which is the whole of the motion
   here; under prefers-reduced-motion it still takes the press and does not
   travel. A locked control has to look locked: the colour menu is offered
   to everybody and only its Save is closed, so a button that looks live
   and does nothing is worse than no button. */
const BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent " +
  "font-semibold leading-none transition-[background-color,color,transform] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "motion-safe:active:translate-y-px " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0";

type Shared = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
};

type AsButton = Shared & Omit<ComponentPropsWithoutRef<"button">, "className"> & { href?: undefined };
type AsLink = Shared & Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & { href: string };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

/* Given an href it renders a Link, because half the call sites are
   navigation dressed as a button and the alternative is a router push
   behind an onClick, which costs the reader middle-click and open in a
   new tab. */
export function Button(props: AsButton | AsLink) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const classes = buttonClass(variant, size, className);

  if (rest.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<AsLink, keyof Shared>;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as Omit<AsButton, keyof Shared>;
  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
