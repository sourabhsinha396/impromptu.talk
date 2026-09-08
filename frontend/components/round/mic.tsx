"use client";

import { useEffect, useRef, useState } from "react";

import { MicOffIcon } from "@/components/site/icons";
import { DEAF_AFTER_MS, type Listener } from "@/lib/round/voice";

/* Proof the round is being heard, as approved in docs/mocks/recording.html.

   Until this, the microphone was only ever reported on once the round was
   over: a device that opened and heard nothing gave one sentence on the
   done screen sixty seconds late, and one that never opened at all drew
   nothing at all, on that round and every round after it. For the whole
   minute a working round and a broken one looked identical, so there was
   no moment at which anybody could have fixed it.

   Nothing new is measured here. The level is already sampled fifty times a
   second for the timeline, and these two components only draw it. */

/** How many bars, and how tall each one stands relative to the level. The
    middle is the tallest, so the row reads as one shape rather than five
    lights. */
const WEIGHTS = [0.5, 0.8, 1, 0.78, 0.48];

/** The bar at rest, in pixels, and how much the loudest voice adds. */
const REST = 10;
const REACH = 36;

/** What a full-height bar is, and the curve up to it.

    Speech sits well under an RMS of 1 - a laptop microphone with the gain
    control off reads a few hundredths for an ordinary voice and a fifth
    for a loud one - so a bar drawn as a fraction of the maximum a sample
    can hold barely twitches. Full height is therefore a shout and not a
    clipped sample, and the climb to it is a square root, because loudness
    is heard on a curve and a linear meter reads dead for exactly the
    person talking normally: a level of 0.05 stands at two fifths here
    where it stood at one seventh before. */
const FULL = 0.3;
const shape = (level: number) => Math.min(Math.sqrt(level / FULL), 1);

/** How fast a bar follows the level. A bar that followed every frame of a
    raw RMS would flicker rather than move. */
const EASE = 0.3;

/* The meter is driven outside React, on one animation frame loop writing
   heights straight onto the bars. State fifty times a second would
   re-render the clock, the topic and the notes with it, on the one screen
   in the product where nothing may stutter. */
export function Meter({ listener, speaking }: { listener: Listener | null; speaking: boolean }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  /* One flip a round, not one a frame: whether the speaking has run long
     enough with nothing arriving to say so. */
  const [deaf, setDeaf] = useState(false);

  /* The drawing, on its own loop and holding no state: a setter called
     sixty times a second is sixty chances to re-render the clock, the
     topic and the notes with it. */
  useEffect(() => {
    if (!speaking) {
      // Paused: nothing is being recorded, so the bars say nothing rather
      // than holding the last height somebody's voice left them at.
      bars.current.forEach((bar) => bar && (bar.style.height = `${REST}px`));
      return;
    }
    let smoothed = 0;
    let frame = requestAnimationFrame(function draw(now: number) {
      frame = requestAnimationFrame(draw);
      smoothed += (shape(listener?.level ?? 0) - smoothed) * EASE;
      bars.current.forEach((bar, index) => {
        if (!bar) return;
        // A slow wobble across the row, so a steady voice still moves.
        const wobble = 0.72 + 0.28 * Math.abs(Math.sin(now / 150 + index * 0.9));
        bar.style.height = `${Math.round(REST + smoothed * WEIGHTS[index] * wobble * REACH)}px`;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [listener, speaking]);

  /* The verdict, asked twice a second and answered afresh each time.

     Asked once at four seconds it accused anybody who took five to begin,
     and there was no way back from it for the rest of the round. Asked
     again it costs a slow starter a moment of the line, and the line goes
     the instant their voice arrives. */
  useEffect(() => {
    if (!speaking || !listener) return;
    setDeaf(false);
    const started = performance.now();
    const tick = setInterval(() => {
      setDeaf(performance.now() - started > DEAF_AFTER_MS && !listener.heard);
    }, 500);
    return () => clearInterval(tick);
  }, [listener, speaking]);

  return (
    <>
      <div
        className="mx-auto mt-4 mb-1 flex h-12 items-center justify-center gap-2"
        role="img"
        aria-label={deaf ? "Nothing is reaching your microphone" : "Your microphone is being heard"}
      >
        {WEIGHTS.map((_, index) => (
          <span
            key={index}
            ref={(node) => {
              bars.current[index] = node;
            }}
            style={{ height: REST }}
            className={`block w-2.5 rounded-full ${deaf ? "bg-warn" : "bg-accent"}`}
          />
        ))}
      </div>
      {/* The second half of the sentence is the important half: somebody
          who reads only "we can't hear you" stops talking, which costs
          them the round as well as the report. */}
      {deaf && (
        <p className="mx-auto mt-3 flex max-w-[40ch] items-center justify-center gap-2 text-[13.5px] font-semibold text-warn">
          <MicOffIcon size={15} className="shrink-0" />
          <span>
            We can&apos;t hear you. <span className="font-medium text-muted">This round still counts.</span>
          </span>
        </p>
      )}
    </>
  );
}

/* The check that runs before the clock, on the topic screen, where the
   microphone has been open for as long as somebody has been reading the
   topic. Fixing it here costs nothing; four seconds into the speaking it
   has already cost the report.

   It says nothing at all when it passes. Silence is the good state, so the
   topic screen keeps its near-zero words. */
export function MicCheck({ listener }: { listener: Listener | null }) {
  const [dead, setDead] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!listener) return;
    const tick = setInterval(() => setDead(listener.dead), 500);
    return () => clearInterval(tick);
  }, [listener]);

  /* Closing the device and opening it again, because the common fix is
     picking a different input, and a stream already open does not follow
     somebody changing their mind in the system mixer. */
  const again = async () => {
    if (!listener || checking) return;
    setChecking(true);
    setDead(false);
    await listener.stop();
    await listener.start();
    setChecking(false);
  };

  if (!dead || checking) return null;

  return (
    <p className="mx-auto mt-7 flex max-w-[44ch] items-start gap-2.5 text-left text-[13.5px] leading-normal text-muted">
      <MicOffIcon size={16} className="mt-0.5 shrink-0 text-warn" />
      <span>
        <span className="font-semibold text-ink">We can&apos;t hear your microphone.</span> Check it isn&apos;t muted,
        and that the right one is picked.{" "}
        <button
          type="button"
          onClick={() => void again()}
          className="cursor-pointer font-semibold text-accent-strong underline underline-offset-4 hover:text-ink"
        >
          Check again
        </button>
      </span>
    </p>
  );
}
