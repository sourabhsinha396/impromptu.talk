import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Ping } from "@/components/site/ping";

describe("Ping", () => {
  it("is hidden from a screen reader, because it says nothing the words beside it do not", () => {
    const { container } = render(<Ping />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
  });

  it("only pulses under motion-safe, so asking for less motion is honoured", () => {
    /* A dot that pulses forever is the kind of motion somebody turns off
       at the operating system, and nothing on the screen would show this
       being lost: dropping the variant would still look right to whoever
       made the change. */
    const { container } = render(<Ping />);
    const ring = container.querySelector(".rounded-full");
    expect(ring?.className).toContain("motion-safe:animate-ping");
    expect(ring?.className).not.toMatch(/(^|\s)animate-ping/);
  });

  it("takes a colour by name and never a colour of its own", () => {
    /* The accent is the one colour somebody can change, so a caller that
       could pass a hex would be a second palette nobody could restyle. */
    const { container } = render(<Ping tone="warn" size={12} />);
    expect(container.innerHTML).toContain("bg-warn");
    expect(container.firstElementChild).toHaveStyle({ width: "12px", height: "12px" });
  });
});
