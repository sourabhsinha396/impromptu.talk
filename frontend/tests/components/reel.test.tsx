import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reel } from "@/components/round/reel";
import { SPIN_MS } from "@/lib/round/sound";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Reel", () => {
  it("rolls the decoys past and settles on the winner exactly once, even if the transition never ends", () => {
    const onSettle = vi.fn();
    const decoys = ["Queues", "Socks", "Rent"];
    render(<Reel decoys={decoys} winner="Low tide" onSettle={onSettle} />);
    expect(screen.getByText("Low tide")).toBeInTheDocument();
    expect(screen.getAllByText(/Queues|Socks|Rent|Low tide/)).toHaveLength(4);

    /* Two frames later the strip is on its way to the last row. */
    act(() => vi.advanceTimersByTime(40));
    const strip = screen.getByText("Low tide").parentElement!.parentElement!;
    expect(strip.style.transform).toContain("-100% * 3 / 4");
    expect(strip.style.transition).toContain(`${SPIN_MS}ms`);

    /* A backgrounded tab loses transitionend; the timeout still settles. */
    act(() => vi.advanceTimersByTime(SPIN_MS + 400));
    expect(onSettle).toHaveBeenCalledOnce();
    fireEvent.transitionEnd(strip);
    expect(onSettle).toHaveBeenCalledOnce();
  });
});
