import { cn } from "@/lib/utils";

/* A light running round the edge of whatever it sits inside, for the one
   control on a screen worth pressing next.

   No dependency, and none needed. The library version of this effect
   animates the travel from JavaScript, which would put an animation
   runtime on the done screen - a screen every round ends on - to
   decorate one button. What moves here is `offset-distance`, which is a
   length, so CSS interpolates it on its own: the whole beam is one
   keyframe in `globals.css` and two spans, and nothing hydrates.

   The path is the control's own perimeter rather than a gradient turning
   behind it. A conic gradient sweeps by angle, so on a pill twice as
   wide as it is tall the light crawls round the two ends and races along
   the edges; this moves the same number of pixels a second the whole way
   round. The corner radius is asked for far larger than any control and
   clamps itself, so the path follows a pill or a card without being told
   which it is on.

   Decoration and nothing else. It is `aria-hidden`, because the control
   it rings already says in words what it does, and `pointer-events-none`,
   so it can never eat the press it is pointing at. It runs only under
   `motion-safe`: with reduced motion asked for the ring stays and the
   light stops, which is the same bargain `Ping` makes. */

/* The colour is the accent, by name, and never a prop holding a hex. A
   caller that could pass its own colour is a second palette, and the
   accent is the one thing on the site somebody can change. */
export function BorderBeam({
  seconds = 5,
  width = 2,
  length = 44,
  className,
}: {
  /** How long one lap takes. */
  seconds?: number;
  /** The ring's thickness, in pixels. */
  width?: number;
  /** How long the light and its tail are, in pixels. */
  length?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      style={{
        padding: width,
        /* Only the border is shown: one mask layer clipped to the content
           box, one over the whole box, and the overlap excluded. It is
           the way to light an edge of any shape without knowing what is
           behind the control, which this one needs - the same button
           sits on the page on the done screen and on a card on the
           filming board. */
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
        WebkitMaskComposite: "xor",
      }}
    >
      {/* Square, so it turns with the path without changing length, and
          lit at the leading edge so what goes round has a head and a
          tail rather than being a bar with two ends. */}
      <span
        className="absolute aspect-square motion-safe:animate-beam"
        style={{
          width: length,
          animationDuration: `${seconds}s`,
          offsetPath: "rect(0 auto auto 0 round 9999px)",
          background: "linear-gradient(to left, var(--accent-strong), var(--accent), transparent)",
        }}
      />
    </span>
  );
}
