import { cn } from "@/lib/utils";

/* A dot with a ring going out of it, for pointing at the one thing worth
   pressing next.

   Decoration and nothing else: it is `aria-hidden`, because whatever it
   sits beside already says in words what it is for, and a screen reader
   being told "ping" would be told about a shape rather than an action.

   The ring only moves under `motion-safe`. With reduced motion asked for
   the dot is still there and still marks the place; it simply stops
   pulsing, which is the whole of what motion adds here. */

/* Colours come from the token set, never from a prop holding a hex: a
   caller that could pass its own colour is a second palette, and the
   accent is the one thing on the site somebody can change. So the choice
   is a name, and the names map to utilities Tailwind can see at build
   time - a class assembled as `bg-${tone}` is not in the stylesheet. */
type Tone = "accent" | "accent-strong" | "warn" | "ink";

const TONES: Record<Tone, string> = {
  accent: "bg-accent",
  "accent-strong": "bg-accent-strong",
  warn: "bg-warn",
  ink: "bg-ink",
};

export function Ping({
  tone = "accent",
  size = 8,
  className,
}: {
  tone?: Tone;
  /** Across, in pixels. The ring goes out to twice this. */
  size?: number;
  className?: string;
}) {
  const colour = TONES[tone];
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* The ring, drawn under the dot so the dot keeps its edge as the
          ring passes through it. */}
      <span className={cn("absolute inset-0 rounded-full opacity-75 motion-safe:animate-ping", colour)} />
      <span className={cn("relative size-full rounded-full", colour)} />
    </span>
  );
}
