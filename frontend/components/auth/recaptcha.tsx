"use client";

import { useEffect, useId, useRef, useState } from "react";

type RecaptchaApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark" | "light";
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
    },
  ): number;
  reset(widgetId: number): void;
};

declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
    __yapholicRecaptchaOnLoad?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const SCRIPT_ID = "google-recaptcha-v2";
const ONLOAD_CALLBACK = "__yapholicRecaptchaOnLoad" as const;
let loading: Promise<RecaptchaApi> | null = null;

/* The script tag's own `load` event fires once the file has downloaded,
   which is not the same moment Google finishes attaching `render` to
   `window.grecaptcha` - a plain `load` listener resolves too early and
   `render` throws "is not a function" a beat later. Google's own fix is
   the `onload` query param: a named global function it calls itself,
   once initialisation is actually done. A module-level promise, not
   component state, since two forms mounting in the same session (signup,
   then login after a redirect) must not inject the script twice. */
function loadRecaptcha(): Promise<RecaptchaApi> {
  if (!SITE_KEY) return Promise.reject(new Error("reCAPTCHA site key is unavailable."));
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    window[ONLOAD_CALLBACK] = () => (window.grecaptcha ? resolve(window.grecaptcha) : reject(new Error("reCAPTCHA did not load.")));
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit&onload=${ONLOAD_CALLBACK}`;
    script.addEventListener("error", () => reject(new Error("reCAPTCHA did not load.")), { once: true });
    document.head.appendChild(script);
  });
  return loading;
}

/* The v2 checkbox, drawn only when a site key ships (the backend's own
   pair is what actually verifies a token; this only decides whether the
   widget renders, mirroring the Google button). The token lives in this
   hook's state, not the widget's own DOM, so a failed submit can call
   `reset()`: a used or expired token cannot be resubmitted. The theme is
   read once at mount from the same `data-theme` attribute the rest of
   the site's theming reads. */
export function useRecaptcha() {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState(false);
  const domId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadRecaptcha()
      .then((api) => {
        if (cancelled || !container.current || widgetId.current !== null) return;
        const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        widgetId.current = api.render(container.current, {
          sitekey: SITE_KEY,
          theme,
          callback: setToken,
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function reset() {
    if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
    setToken("");
  }

  const widget = SITE_KEY ? (
    <div>
      <div ref={container} id={domId} className="min-h-[78px] max-w-full overflow-x-auto" />
      {loadError && <p role="alert" className="mt-1 text-sm text-ink">Verification could not load. Refresh the page and try again.</p>}
    </div>
  ) : null;

  return { widget, token, reset };
}
