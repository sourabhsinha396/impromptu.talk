import { cn } from "@/lib/utils";

/* A shape standing where a number has not arrived yet.

   Used by the done screen while the round is being read back. The report
   is drawn as its own empty frame - every card and band at the size it
   will be, the titles already in ink, and only the values missing - so
   nothing on the screen moves when the reading lands. That only works if
   the placeholder is exactly the size of the thing it stands for, which is
   why it takes its size from the caller and never sets one.

   The wait it replaced was `animate-pulse` on `bg-line`: on white that is
   full to half opacity on a hairline, about one percent of contrast, and
   every person who watched it read the screen as finished and broken
   rather than as busy. A band of accent crossing the shape is visible from
   across a room, which is the distance this site is looked at from.

   Decoration, and `aria-hidden` for it: the block it sits in says in words
   that the round is being read back, and a screen reader being handed nine
   nameless shapes would be told about a layout rather than about a wait. */
export function Placeholder({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span aria-hidden className={cn("relative block overflow-hidden rounded-md bg-line", className)}>
      {/* Staggered by the caller, a card at a time, so the frame reads as
          one thing filling rather than as nine things blinking at once. */}
      <span
        className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-accent/35 to-transparent motion-safe:animate-shimmer"
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      />
    </span>
  );
}
