import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/* The text field, in the shadcn shape on our tokens: the same border,
   fill and radius as the settings sheet's select, because a page and a
   sheet should not have two kinds of input. `line-strong` rather than
   `line`, since a control has to look pressable. The ring is the accent,
   as every focus on the site is. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-[10px] border border-line-strong bg-card2 px-3.5 py-3 text-[15.5px] font-medium text-ink outline-none transition-colors",
        "placeholder:text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className,
      )}
      {...props}
    />
  );
}
