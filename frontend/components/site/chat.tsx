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

/* Where the tool is, and the one rule this component has. A bubble in the
   corner is one more thing between a stranger and the one button, and on
   these pages the button is the whole point: home is the tool, and a
   feature page is the same tool with a different middle - it opens *on* a
   passage with no landing screen at all (docs/DECISIONS.md), so everything
   that argues against a bubble at home argues for none here. A visitor who
   has questions has already left for a genre, a price or a policy, and the
   chat is waiting on every one of those. */
const TOOLS = new Set(["/", "/tongue-twisters"]);

/* Support chat, everywhere but the tool. The website id is public: it
   names the inbox a message lands in. Signed in, the address rides on the
   session so a conversation can be put to a person. `chat` on the body is
   how the footer knows to leave room for the bubble. */
export function Chat({ websiteId, email = "", name = "" }: { websiteId: string; email?: string; name?: string }) {
  const tool = TOOLS.has(usePathname());

  useEffect(() => {
    if (tool) {
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
  }, [tool, websiteId, email, name]);

  return null;
}
