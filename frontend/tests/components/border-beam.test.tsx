import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BorderBeam } from "@/components/site/border-beam";

describe("BorderBeam", () => {
  it("is hidden from a screen reader and cannot be pressed, so it never stands in front of the control it rings", () => {
    const { container } = render(<BorderBeam />);
    const ring = container.firstElementChild;
    expect(ring).toHaveAttribute("aria-hidden");
    expect(ring?.className).toContain("pointer-events-none");
  });

  it("only runs under motion-safe, so asking for less motion is honoured", () => {
    /* A light going round forever is the kind of motion somebody turns
       off at the operating system, and nothing on the screen would show
       this being lost: dropping the variant would still look right to
       whoever made the change. */
    const { container } = render(<BorderBeam />);
    const light = container.querySelector("[style*='offset-path']");
    expect(light?.className).toContain("motion-safe:animate-beam");
    expect(light?.className).not.toMatch(/(^|\s)animate-beam/);
  });

  it("travels the control's own perimeter, so the light moves at one speed the whole way round", () => {
    /* The reason this is a path and not a conic gradient turning behind
       the button: a gradient sweeps by angle, so on a pill twice as wide
       as it is tall the light crawls round the two ends and races along
       the edges. Drawn that way first, and it read as two glowing caps. */
    const { container } = render(<BorderBeam />);
    const light = container.querySelector<HTMLElement>("[style*='offset-path']");
    expect(light?.style.offsetPath).toContain("rect(");
  });

  it("takes its colour from the accent and never holds one of its own", () => {
    /* The accent is the one colour somebody can change, so a beam
       carrying a hex would be a second palette nobody could restyle. */
    const { container } = render(<BorderBeam seconds={7} />);
    const light = container.querySelector<HTMLElement>("[style*='offset-path']");
    /* The beam's own colour, not the ring's mask: the mask is drawn in
       black because black is opaque in a mask, and it is a stencil
       rather than anything anybody sees. */
    expect(light?.style.background).toContain("var(--accent)");
    expect(light?.style.background).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(light?.style.animationDuration).toBe("7s");
  });
});
