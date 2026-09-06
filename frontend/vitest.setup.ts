import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

/* jsdom ships none of these, and the menu primitive observes its trigger
   and captures the pointer on open. Without them every test that opens a
   menu dies inside the library rather than on anything it was written to
   check. */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!("PointerEvent" in globalThis)) {
  globalThis.PointerEvent = globalThis.MouseEvent as unknown as typeof PointerEvent;
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
}
