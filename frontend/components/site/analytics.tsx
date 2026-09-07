"use client";

import { useEffect } from "react";

import { attach } from "@/lib/analytics";

type PostHog = {
  __loaded?: boolean;
  init(token: string, config: Record<string, unknown>): void;
  capture(name: string, props?: Record<string, unknown>): void;
  identify(id: string, props?: Record<string, unknown>): void;
};

declare global {
  interface Window {
    posthog?: PostHog;
  }
}

/* PostHog with its own current defaults on: autocapture, pageviews and
   session replay as the project configures them. The one thing the site
   adds is the mask on `.ph-no-capture`, which the prep textareas and the
   speak chips carry: the notes are the visitor's own words, and the chips
   are text rather than inputs, so the default input masking cannot reach
   them once they are shown back. A mask naming a class nothing carries
   fails silently, so the round's test pins the markup. */
export const POSTHOG_INIT = {
  defaults: "2026-05-30",
  session_recording: { maskTextSelector: ".ph-no-capture" },
} as const;

export function posthogScript(host: string): string {
  return `${host}/static/array.js`;
}

/* PostHog's browser build, loaded async from its host once the page is
   up, so analytics can never delay the one button. The distinct id is the
   device: it is what the sessions table joins on, and the only id an
   anonymous visitor has, so switching it at sign-in would split one person
   into two. Signed in, the address and the name ride along as person
   properties, so a recording is found by the person who wrote in. A first
   visit has no device cookie yet, so no identify happens and the library
   keeps its own anonymous id, which the identify on the next page load
   folds into the device. */
export function Analytics({
  token,
  host,
  deviceId,
  email,
  name,
}: {
  token: string;
  host: string;
  deviceId: string;
  email: string;
  name: string;
}) {
  useEffect(() => {
    const ready = () => {
      const posthog = window.posthog;
      if (!posthog) return;
      try {
        if (!posthog.__loaded) posthog.init(token, { api_host: host, ...POSTHOG_INIT });
        if (deviceId) posthog.identify(deviceId, email ? { email, ...(name ? { name } : {}) } : undefined);
        attach((event, props) => posthog.capture(event, props));
      } catch {
        attach(null);
      }
    };
    if (window.posthog?.__loaded) {
      ready();
    } else if (!document.querySelector(`script[src="${posthogScript(host)}"]`)) {
      const script = document.createElement("script");
      script.src = posthogScript(host);
      script.async = true;
      script.onload = ready;
      document.head.appendChild(script);
    }
    return () => attach(null);
  }, [token, host, deviceId, email, name]);

  return null;
}
