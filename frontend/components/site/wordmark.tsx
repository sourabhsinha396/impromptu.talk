import { LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";

/* The mark and the name, said together the same way everywhere, phone
   included. The die carries the accent while the name stays ink, so the
   pair reads as a mark plus a name rather than as one coloured lump. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink",
        className,
      )}
    >
      <LogoMark className="size-[21px] shrink-0 text-accent" />
      yapholic
    </span>
  );
}
