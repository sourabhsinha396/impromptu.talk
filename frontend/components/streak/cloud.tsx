"use client";

import { useEffect, useState } from "react";

import type { Report } from "@/lib/report";
import { STEPS, place, tally, type Box, type Placed } from "@/lib/words";

/* The minute drawn as a cloud: every word said, sized and shaded by how
   often, packed across and down.

   The one drawing on the round's page that answers what the minute
   sounded like rather than how it was timed. The section above it counts
   the words somebody leans on, which is a short list the reading picked;
   this is all of them, and on most rounds the largest word turns out to
   be a pronoun, which is worth knowing: a minute about cats in which
   somebody says "they" eight times and "cats" once is a minute that
   never named its subject.

   Drawn client-side from the transcript the round already carries, so
   nothing new is measured and no second call is made. */

/* Five steps down one accent ramp, strongest for the most said. One hue
   and never a second colour, so the cloud belongs to whoever picked
   their accent instead of importing a palette of its own. Warm is kept
   out of the ramp and means one thing here, as it does everywhere else:
   a filler. */
const RAMP = [
  "var(--accent-strong)",
  "var(--accent)",
  "color-mix(in oklab, var(--accent) 72%, var(--muted))",
  "color-mix(in oklab, var(--accent) 46%, var(--muted))",
  "color-mix(in oklab, var(--accent) 26%, var(--muted))",
];

export function WordCloud({ report }: { report: Report }) {
  const [drawn, setDrawn] = useState<{ placed: Placed[]; box: Box } | null>(null);
  const transcript = report.transcript;

  useEffect(() => {
    const words = tally(transcript);
    if (!words.length) return;
    let live = true;
    /* Measured with the real face or not at all: the widths decide the
       packing, and the fallback font is wide enough to leave the cloud
       full of holes once the real one swaps in. */
    const ready = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
    void ready.then(() => {
      if (live) setDrawn(place(words, measurer()));
    });
    return () => {
      live = false;
    };
  }, [transcript]);

  if (!drawn || !drawn.placed.length) return null;
  const fillers = new Set(report.filler_words.map((word) => word.toLowerCase()));
  const { box, placed } = drawn;

  return (
    <div>
      <svg
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        className="block h-auto w-full font-display font-semibold [dominant-baseline:middle]"
        role="img"
        aria-label={`The words of this round, largest the one you said most: ${placed[0].word}, ${placed[0].count} times`}
      >
        {placed.map((word) => (
          <text
            key={word.word}
            x={word.x}
            y={word.y}
            fontSize={word.size}
            textAnchor="middle"
            fill={fillers.has(word.word) ? "var(--warn)" : RAMP[Math.min(STEPS - 1, word.step)]}
            transform={word.down ? `rotate(-90 ${word.x} ${word.y})` : undefined}
          >
            <title>{`${word.word}, said ${word.count} ${word.count === 1 ? "time" : "times"}`}</title>
            {word.word}
          </text>
        ))}
      </svg>
      {/* Said out loud, because a reader who takes the arrangement for a
          meaning is reading noise: a word is central because it went
          down early, which is because it was said often, which its size
          already told them. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-4.5 gap-y-1 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-[3px]">
            {[...RAMP].reverse().map((colour) => (
              <i key={colour} className="inline-block h-2.5 w-3.5 rounded-[2px]" style={{ background: colour }} />
            ))}
          </span>
          said once, up to said most
        </span>
        {fillers.size > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[2px] bg-warn" /> a filler
          </span>
        )}
        <span>Where a word sits means nothing.</span>
      </p>
    </div>
  );
}

/* One canvas for the life of the page: making one per word is the
   slowest part of packing a hundred of them.

   And a canvas that will not open is not a failure. A browser told to
   block canvas fingerprinting throws here, and jsdom does not implement
   it at all, so the width falls back to a guess off the letter count:
   the cloud is looser than it should be and every word is still there,
   which beats the section disappearing. */
let pad: CanvasRenderingContext2D | null | undefined;

function measurer() {
  if (pad === undefined) {
    try {
      // `?? null` because jsdom reports rather than throws and hands back
      // undefined, which would leave this looking uninitialised and open
      // a canvas again for every word.
      pad = document.createElement("canvas").getContext("2d") ?? null;
    } catch {
      pad = null;
    }
  }
  const ctx = pad;
  return (word: string, size: number) => {
    if (!ctx) return word.length * size * 0.52;
    ctx.font = `600 ${size}px "Bricolage Grotesque", ui-sans-serif, sans-serif`;
    return ctx.measureText(word).width;
  };
}
