import { describe, expect, it } from "vitest";

import { MAX_PICTURE_BYTES } from "@/lib/owned";
import { fit, MAX_SIDE } from "@/lib/pictures";

/* The compressing itself needs a canvas and a WebP encoder, which is a
   browser and not this runner. What is pinned here is the arithmetic in
   front of it and the two numbers that have to agree with the backend,
   because both would go wrong quietly: a picture that comes out one pixel
   over is a second resize on the server, and a ceiling that drifts apart
   is an upload the browser passes and the route refuses. */
describe("sizing a picture before it goes up", () => {
  it("leaves a picture already inside the ceiling at its own size", () => {
    expect(fit(800, 600, MAX_SIDE)).toEqual({ width: 800, height: 600 });
  });

  it("never upscales, because that adds bytes and no detail", () => {
    expect(fit(120, 90, MAX_SIDE)).toEqual({ width: 120, height: 90 });
  });

  it("holds the aspect ratio when it takes the longest side down", () => {
    expect(fit(4000, 3000, 1400)).toEqual({ width: 1400, height: 1050 });
    expect(fit(3000, 4000, 1400)).toEqual({ width: 1050, height: 1400 });
  });

  it("agrees with the backend on the ceiling and the longest side", () => {
    // backend/apps/topics/pictures.py: MAX_BYTES and MAX_SIDE.
    expect(MAX_PICTURE_BYTES).toBe(1024 * 1024);
    expect(MAX_SIDE).toBe(1400);
  });
});
