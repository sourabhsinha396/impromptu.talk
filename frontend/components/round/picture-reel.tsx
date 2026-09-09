"use client";

import { useEffect, useRef } from "react";

import { SPIN_MS } from "@/lib/round/sound";

/* The slot machine, for a picture round.

   The same strip and the same timing as the sentence reel beside it, so
   the two rounds feel like one product: what rolls past is different, the
   moment of no take-backs is not. What rolls past is skeletons rather
   than real photographs, because eleven real ones would be eleven
   downloads nobody sees for more than 80ms - the point of the roll is
   motion and anticipation, and a skeleton delivers both at no weight.

   Four shapes cycle so successive rows do not read as one block sliding:
   a horizon, a portrait, a pair and a close-up. They are drawn from the
   tokens, never raw colour, so the strip belongs to whichever accent and
   theme somebody is on. */

const SHAPES = ["horizon", "portrait", "pair", "closeup"] as const;

function Skeleton({ shape }: { shape: (typeof SHAPES)[number] }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-card2">
      {shape === "horizon" && (
        <>
          <div className="absolute inset-x-0 top-0 h-[62%] bg-line/70" />
          <div className="absolute inset-x-0 bottom-0 h-[38%] bg-line-strong/25" />
          <div className="absolute top-[18%] left-[14%] size-[14%] rounded-full bg-line-strong/30" />
        </>
      )}
      {shape === "portrait" && (
        <>
          <div className="absolute inset-0 bg-line/60" />
          <div className="absolute bottom-0 left-1/2 h-[52%] w-[34%] -translate-x-1/2 rounded-t-full bg-line-strong/30" />
          <div className="absolute top-[16%] left-1/2 size-[20%] -translate-x-1/2 rounded-full bg-line-strong/30" />
        </>
      )}
      {shape === "pair" && (
        <>
          <div className="absolute inset-0 bg-line/60" />
          <div className="absolute bottom-[14%] left-[16%] h-[46%] w-[26%] rounded-xl bg-line-strong/30" />
          <div className="absolute bottom-[14%] right-[16%] h-[58%] w-[26%] rounded-xl bg-line-strong/25" />
        </>
      )}
      {shape === "closeup" && (
        <>
          <div className="absolute inset-0 bg-line/60" />
          <div className="absolute top-1/2 left-1/2 size-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong/30" />
        </>
      )}
      {/* The site's own shimmer, the one the report's placeholders use, so
          a waiting shape looks the same everywhere. Motion-safe only: the
          strip itself already travels, and somebody who asked for less of
          it should not get a second animation on every row. */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface/25 to-transparent motion-safe:animate-shimmer" />
    </div>
  );
}

/* The strip is committed at rest, then given its transform two frames
   later, or there is nothing to transition. `transitionend` is lost if
   the tab is backgrounded mid-spin, so a timeout guarantees the round
   arrives regardless; the engine ignores a second settle. */
export function PictureReel({ rows, image, onSettle }: { rows: number; image: string; onSettle: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const total = rows + 1;

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
        el.style.transform = `translateY(calc(-100% * ${total - 1} / ${total}))`;
      });
    });
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(first);
      el.removeEventListener("transitionend", settle);
    };
  }, [rows, image, total, onSettle]);

  return (
    <div className="mx-auto aspect-[4/3] w-full max-w-[460px] overflow-hidden" aria-hidden>
      <div ref={strip} className="will-change-transform">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="aspect-[4/3] w-full p-px">
            <Skeleton shape={SHAPES[index % SHAPES.length]} />
          </div>
        ))}
        {/* The winner, already decoded by the time it stops: the browser
            starts fetching it as the strip begins to roll. */}
        <div className="aspect-[4/3] w-full p-px">
          <div className="h-full w-full overflow-hidden rounded-[18px] bg-card2 shadow-[0_10px_30px_rgb(0_0_0/0.16)]">
            <img src={image} alt="" width={1000} height={750} fetchPriority="high" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}
