import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Analytics, POSTHOG_INIT, posthogScript } from "@/components/site/analytics";
import { attach, track } from "@/lib/analytics";

const HOST = "https://eu.i.posthog.com";
const TOKEN = "phc_test_token_000";
const DEVICE = "0123456789abcdef0123456789abcdef";

function library() {
  return { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), __loaded: false };
}

/* The script tag is appended and, when it "loads", PostHog's global is
   there the way the real build leaves it. */
function land(posthog: ReturnType<typeof library>) {
  const script = document.querySelector<HTMLScriptElement>(`script[src="${posthogScript(HOST)}"]`);
  expect(script).not.toBeNull();
  expect(script?.async).toBe(true);
  window.posthog = posthog;
  posthog.init.mockImplementation(() => {
    posthog.__loaded = true;
  });
  act(() => script?.onload?.(new Event("load")));
}

beforeEach(() => {
  delete window.posthog;
  document.querySelectorAll("script").forEach((script) => script.remove());
});
afterEach(() => attach(null));

describe("Analytics", () => {
  it("loads PostHog's own build from the host, async, and inits with the token and the mask", () => {
    const posthog = library();
    render(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="" name="" />);
    expect(document.querySelectorAll("script")).toHaveLength(1);
    land(posthog);
    expect(posthog.init).toHaveBeenCalledWith(TOKEN, { api_host: HOST, ...POSTHOG_INIT });
  });

  /* The chips in the speak phase are text, not inputs, so the default
     input masking cannot reach them; this selector is what does. */
  it("masks the class the notes carry, and leaves PostHog's other defaults alone", () => {
    expect(POSTHOG_INIT.session_recording).toEqual({ maskTextSelector: ".ph-no-capture" });
    expect(POSTHOG_INIT).not.toHaveProperty("autocapture");
    expect(POSTHOG_INIT).not.toHaveProperty("disable_surveys");
    expect(POSTHOG_INIT).not.toHaveProperty("disable_session_recording");
  });

  it("identifies with the device id, never the address, and puts the address and name on the person", () => {
    const posthog = library();
    render(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="speaker@example.com" name="Priya" />);
    land(posthog);
    expect(posthog.identify).toHaveBeenCalledWith(DEVICE, { email: "speaker@example.com", name: "Priya" });
  });

  it("sends no person properties for a stranger", () => {
    const posthog = library();
    render(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="" name="" />);
    land(posthog);
    expect(posthog.identify).toHaveBeenCalledWith(DEVICE, undefined);
  });

  /* A first visit has no device cookie yet; the library keeps its own
     anonymous id until the next page load can fold it into the device. */
  it("does not identify at all without a device id", () => {
    const posthog = library();
    render(<Analytics token={TOKEN} host={HOST} deviceId="" email="" name="" />);
    land(posthog);
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.init).toHaveBeenCalledOnce();
  });

  it("delivers the events that were fired before it landed, after identify", () => {
    const posthog = library();
    render(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="" name="" />);
    track("spin_started", { genre: "general" });
    expect(posthog.capture).not.toHaveBeenCalled();
    land(posthog);
    expect(posthog.capture).toHaveBeenCalledWith("spin_started", { genre: "general" });
    expect(posthog.identify.mock.invocationCallOrder[0]).toBeLessThan(posthog.capture.mock.invocationCallOrder[0]);
  });

  it("never inits twice when the layout re-renders with the library already up", () => {
    const posthog = library();
    const view = render(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="" name="" />);
    land(posthog);
    view.rerender(<Analytics token={TOKEN} host={HOST} deviceId={DEVICE} email="speaker@example.com" name="" />);
    expect(posthog.init).toHaveBeenCalledOnce();
    expect(posthog.identify).toHaveBeenLastCalledWith(DEVICE, { email: "speaker@example.com" });
    expect(document.querySelectorAll("script")).toHaveLength(1);
  });
});
