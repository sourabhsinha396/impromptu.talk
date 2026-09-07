"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type CrispCommand = ["do", "chat:hide" | "chat:show"] | ["set", "user:email" | "user:nickname", [string]];

declare global {
  interface Window {
    $crisp?: { push(command: CrispCommand): unknown };
    CRISP_WEBSITE_ID?: string;
  }
}

export const CRISP_SCRIPT = "https://client.crisp.chat/l.js";

/* Support chat, everywhere but the front door. The home page is the tool,
   and a bubble in its corner is one more thing between a stranger and the
   one button; a visitor who has questions has already left it for a genre,
   a price or a policy. The website id is public: it names the inbox a
   message lands in. Signed in, the address rides on the session so a
   conversation can be put to a person. `chat` on the body is how the
   footer knows to leave room for the bubble. */
export function Chat({ websiteId, email = "", name = "" }: { websiteId: string; email?: string; name?: string }) {
  const home = usePathname() === "/";

  useEffect(() => {
    if (home) {
      window.$crisp?.push(["do", "chat:hide"]);
      return;
    }
    window.$crisp ??= [];
    window.CRISP_WEBSITE_ID = websiteId;
    window.$crisp.push(["do", "chat:show"]);
    if (email) window.$crisp.push(["set", "user:email", [email]]);
    if (name) window.$crisp.push(["set", "user:nickname", [name]]);
    document.body.classList.add("chat");
    if (!document.querySelector(`script[src="${CRISP_SCRIPT}"]`)) {
      const script = document.createElement("script");
      script.src = CRISP_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    return () => document.body.classList.remove("chat");
  }, [home, websiteId, email, name]);

  return null;
}
