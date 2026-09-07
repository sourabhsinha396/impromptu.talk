import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CRISP_SCRIPT, Chat } from "@/components/site/chat";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const WEBSITE_ID = "00000000-0000-4000-8000-000000000000";

function commands() {
  return window.$crisp as unknown as unknown[];
}

beforeEach(() => {
  route.pathname = "/genres";
  document.querySelectorAll("script").forEach((script) => script.remove());
  delete window.$crisp;
  delete window.CRISP_WEBSITE_ID;
});
afterEach(() => document.body.classList.remove("chat"));

describe("Chat", () => {
  it("loads Crisp async with the website id on a content page and asks the footer for room", () => {
    render(<Chat websiteId={WEBSITE_ID} />);
    const script = document.querySelector<HTMLScriptElement>(`script[src="${CRISP_SCRIPT}"]`);
    expect(script?.async).toBe(true);
    expect(window.CRISP_WEBSITE_ID).toBe(WEBSITE_ID);
    expect(commands()).toContainEqual(["do", "chat:show"]);
    expect(document.body.classList.contains("chat")).toBe(true);
  });

  /* The front door is one button and nothing else; a bubble in its corner
     is exactly the kind of exclusion a later change removes without
     noticing. */
  it("never loads on the home page", () => {
    route.pathname = "/";
    render(<Chat websiteId={WEBSITE_ID} />);
    expect(window.$crisp).toBeUndefined();
    expect(document.querySelector(`script[src="${CRISP_SCRIPT}"]`)).toBeNull();
    expect(document.body.classList.contains("chat")).toBe(false);
  });

  it("hides on the way back to the home page and shows again after", () => {
    const view = render(<Chat websiteId={WEBSITE_ID} />);
    route.pathname = "/";
    view.rerender(<Chat websiteId={WEBSITE_ID} />);
    expect(commands().at(-1)).toEqual(["do", "chat:hide"]);
    expect(document.body.classList.contains("chat")).toBe(false);

    route.pathname = "/genre/general";
    view.rerender(<Chat websiteId={WEBSITE_ID} />);
    expect(commands().at(-1)).toEqual(["do", "chat:show"]);
    expect(document.body.classList.contains("chat")).toBe(true);
    expect(document.querySelectorAll(`script[src="${CRISP_SCRIPT}"]`)).toHaveLength(1);
  });

  it("puts a signed-in address and name on the session, and nothing for a stranger", () => {
    const view = render(<Chat websiteId={WEBSITE_ID} email="speaker@example.com" name="Priya" />);
    expect(commands()).toContainEqual(["set", "user:email", ["speaker@example.com"]]);
    expect(commands()).toContainEqual(["set", "user:nickname", ["Priya"]]);
    view.unmount();

    delete window.$crisp;
    render(<Chat websiteId={WEBSITE_ID} />);
    expect(commands().some((command) => (command as string[])[0] === "set")).toBe(false);
  });
});
