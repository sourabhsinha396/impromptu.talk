"use client";

import { useEffect, useRef } from "react";

import { SPIN_MS } from "@/lib/round/sound";

/* The slot machine. Decoys roll past and the strip settles on the winner:
   the spin is the moment of no take-backs that a plain text swap does not
   deliver, and the most filmable thing on screen. The strip is committed
   at rest, then two frames later given its transform, or there is nothing
   to transition. `transitionend` is lost if the tab is backgrounded
   mid-spin, so a timeout guarantees the round arrives regardless; the
   engine ignores a second settle. */
export function Reel({ decoys, winner, onSettle }: { decoys: string[]; winner: string; onSettle: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const rows = decoys.length + 1;

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      onSettle();
    };
    el.style.transition = "none";
    el.style.transform = "translateY(0)";
    el.addEventListener("transitionend", settle, { once: true });
    const timeout = setTimeout(settle, SPIN_MS + 400);
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.25, 1.06)`;
        el.style.transform = `translateY(calc(-100% * ${rows - 1} / ${rows}))`;
      });
    });
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(first);
      el.removeEventListener("transitionend", settle);
    };
  }, [decoys, winner, rows, onSettle]);

  return (
    <div className="h-[clamp(5rem,22vw,17rem)] w-full overflow-hidden" aria-live="off" aria-hidden>
      <div ref={strip} className="will-change-transform">
        {[...decoys, winner].map((text, index) => (
          <div key={`${index}-${text}`} className="flex h-[clamp(5rem,22vw,17rem)] items-center justify-center">
            <p className="font-display text-topic font-semibold text-accent text-balance">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
