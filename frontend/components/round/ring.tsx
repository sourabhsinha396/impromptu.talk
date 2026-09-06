import { cn } from "@/lib/utils";

/* The clock: one ring in the same place for thinking and speaking, the
   digits inside and the word under them, so the eye lands in the same
   spot when the phase changes. Warm in the last ten seconds. Tabular
   numerals so the digits do not jitter as they count. */
const CIRCUMFERENCE = 2 * Math.PI * 45;

export function Ring({ fraction, text, label, ending }: { fraction: number; text: string; label: string; ending: boolean }) {
  return (
    <div className="relative mx-auto mt-1 mb-7 aspect-square w-[min(56vw,300px)]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="45" className="fill-none stroke-line" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="45"
          className={cn("fill-none transition-[stroke-dashoffset] duration-100 ease-linear", ending ? "stroke-warn" : "stroke-accent")}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <div
        role="timer"
        aria-live="off"
        className="absolute inset-0 grid place-items-center font-display text-[clamp(3rem,10vw,5.6rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums"
      >
        {text}
      </div>
      <div className="absolute right-0 bottom-[22%] left-0 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
        {label}
      </div>
    </div>
  );
}
