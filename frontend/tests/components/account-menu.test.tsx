import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/site/account-menu";
import type { SessionUser } from "@/lib/api";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

const speaker: SessionUser = { email: "speaker@example.com", name: "", is_superuser: false };

async function open(user: SessionUser | null) {
  render(<AccountMenu user={user} />);
  await userEvent.click(screen.getByRole("button", { name: "Account" }));
}

const items = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("AccountMenu", () => {
  /* The menu holds destinations, not features, and its shape is a product
     rule: these are the entries, in this order, and nothing else. */
  it("offers a stranger the doors in, Pro, Affiliates and the theme", async () => {
    await open(null);
    expect(items()).toEqual(["Create an account", "Sign in", "Pro", "Affiliates"]);
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("names who is signed in by name or email, and lists their pages", async () => {
    await open(speaker);
    expect(screen.getByText("speaker@example.com")).toBeInTheDocument();
    expect(items()).toEqual(["Settings", "Affiliates", "Get Pro", "Sign out"]);
  });

  it("shows Administration only to a superuser and hides Get Pro from someone who has it", async () => {
    await open({ ...speaker, name: "Priya", is_superuser: true, is_pro: true });
    expect(screen.getByText("Priya")).toBeInTheDocument();
    expect(items()).toEqual(["Settings", "Affiliates", "Administration", "Sign out"]);
    expect(screen.getByRole("menuitem", { name: "Administration" })).toHaveAttribute("href", "/administration");
  });

  it("signs out through the API and sends the person home", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", sent);
    await open(speaker);
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/auth/logout", { method: "POST" });
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });
});
