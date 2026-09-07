"use client";

import Script from "next/script";

/* The provider's checkout in a dialog over this page, rather than a
   navigation away from it.

   Decoration over something that already works: every way this can fail
   (a blocked CDN, a script that throws, an SDK that dislikes its
   options) leaves `openDialog` returning false, and the caller navigates
   to the same hosted checkout. Settling knows nothing about any of it;
   the dialog sends the browser to the return URL when it is done, which
   is the /pro/done the redirect would have landed on.

   Pinned: a checkout that changes under us without a commit is not
   something to hear about from a buyer. */
const SDK = "https://cdn.jsdelivr.net/npm/dodopayments-checkout@1.9.9/dist/index.js";

type Sdk = {
  Initialize(options: { mode: string; displayType: string }): void;
  Checkout: { open(options: { checkoutUrl: string }): void };
};

let ready = false;

function sdk(): Sdk | null {
  if (typeof window === "undefined") return null;
  const lib = (window as unknown as { DodoPaymentsCheckout?: { DodoPayments?: Sdk } }).DodoPaymentsCheckout;
  return lib?.DodoPayments ?? null;
}

export function initialize(mode: string): boolean {
  const lib = sdk();
  if (!lib) return (ready = false);
  try {
    lib.Initialize({ mode, displayType: "overlay" });
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

/** True when the dialog is open. False means the caller should navigate,
    which is what buys Pro either way. */
export function openDialog(checkoutUrl: string): boolean {
  if (!ready) return false;
  try {
    sdk()?.Checkout.open({ checkoutUrl });
    return true;
  } catch {
    return false;
  }
}

export function forget() {
  ready = false;
}

export function OverlayScript({ mode }: { mode: string }) {
  return (
    <Script src={SDK} strategy="afterInteractive" onLoad={() => initialize(mode)} onError={forget} />
  );
}
