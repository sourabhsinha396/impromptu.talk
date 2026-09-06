"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/site/button";
import { cn } from "@/lib/utils";

/* The sheet: a panel over the page for a choice made once, closed by
   Done, the backdrop or Escape. On a phone it rises from the bottom; on a
   laptop it sits in the middle. The shadcn shape on the Radix Dialog
   primitive, with our button as the close, and the highlight colours
   passed in from here because the registry's `bg-accent` is our topic
   colour. `data-sheet-open` is what the round's key handler looks for,
   so Space and N stay inside the sheet while it is up. */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  title,
  description,
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <DialogPrimitive.Content
        data-sheet-open=""
        aria-describedby={description ? undefined : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-card border border-line bg-card p-5 text-left text-ink shadow-[0_24px_60px_rgb(0_0_0/0.35)] outline-none",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="font-display text-xl font-semibold">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        <div className="mt-4">{children}</div>
        <div className="mt-5 flex justify-end">
          <DialogPrimitive.Close asChild>
            <Button>Done</Button>
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
