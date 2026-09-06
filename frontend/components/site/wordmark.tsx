import { LogoMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";

/* The mark and the name, said together the same way everywhere. The die
   carries the accent while the name stays ink, so the pair reads as a mark
   plus a name rather than as one coloured lump. The ".talk" is the display
   face at 400: the one place that weight is drawn, which is why the font
   file spans it.

   `collapse` is the header's: on a phone the name gives way to "i.t" so the
   streak pill and the account mark keep their room. */
export function Wordmark({ collapse = false, className }: { collapse?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em] text-ink",
        className,
      )}
    >
      <LogoMark className="size-[21px] shrink-0 text-accent" />
      <span className={collapse ? "hidden sm:inline" : undefined}>
        impromptu<span className="font-normal text-muted">.talk</span>
      </span>
      {collapse && (
        <span className="sm:hidden" aria-hidden>
          i<span className="font-normal text-muted">.</span>t
        </span>
      )}
    </span>
  );
}
