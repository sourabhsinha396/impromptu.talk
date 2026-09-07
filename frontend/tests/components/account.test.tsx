import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccentPicker } from "@/components/account/accent-picker";
import { NameForm } from "@/components/account/name-form";
import { PasswordForm } from "@/components/account/password-form";
import { Sharing } from "@/components/account/sharing";
import { SignOutEverywhere } from "@/components/account/sign-out-everywhere";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
  delete document.documentElement.dataset.accent;
});

const ok = (body: unknown = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
const refused = (detail: string) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 400 }));

describe("the name card", () => {
  it("keeps Save asleep until the field changes, and again when it changes back", async () => {
    vi.stubGlobal("fetch", ok());
    render(<NameForm name="Priya" />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("What we call you"), "n");
    expect(save).toBeEnabled();
    await userEvent.keyboard("{Backspace}");
    expect(save).toBeDisabled();
  });

  it("saves a blank name, because a name is optional and has to be removable", async () => {
    const sent = ok();
    vi.stubGlobal("fetch", sent);
    render(<NameForm name="Priya" />);
    await userEvent.clear(screen.getByLabelText("What we call you"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({ name: "" });
    // The menu and the streak page print this name, so the page is re-read.
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows a refusal beside the button that caused it, not at the top of the page", async () => {
    vi.stubGlobal("fetch", refused("That did not go through."));
    render(<NameForm name="Priya" />);
    await userEvent.type(screen.getByLabelText("What we call you"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That did not go through.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("the colour card", () => {
  it("paints the page as soon as a colour is picked", async () => {
    vi.stubGlobal("fetch", ok());
    render(<AccentPicker accent="lime" />);
    expect(document.documentElement.dataset.accent).toBe("lime");
    await userEvent.click(screen.getByRole("button", { name: "Violet" }));
    expect(document.documentElement.dataset.accent).toBe("violet");
  });

  it("puts an unsaved colour back on the way out, so it cannot follow somebody around the site", async () => {
    vi.stubGlobal("fetch", ok());
    const picker = render(<AccentPicker accent="lime" />);
    await userEvent.click(screen.getByRole("button", { name: "Coral" }));
    picker.unmount();
    expect(document.documentElement.dataset.accent).toBe("lime");
  });

  it("keeps a saved colour on the way out", async () => {
    const sent = ok();
    vi.stubGlobal("fetch", sent);
    const picker = render(<AccentPicker accent="lime" />);
    await userEvent.click(screen.getByRole("button", { name: "Cyan" }));
    await userEvent.click(screen.getByRole("button", { name: "Save colour" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({ accent: "cyan" });
    picker.unmount();
    expect(document.documentElement.dataset.accent).toBe("cyan");
  });
});

describe("the password card", () => {
  it("asks an account with a password to confirm the one it has", async () => {
    const sent = ok();
    vi.stubGlobal("fetch", sent);
    render(<PasswordForm hasPassword />);
    await userEvent.type(screen.getByLabelText("Current password"), "correct horse battery");
    await userEvent.type(screen.getByLabelText("New password"), "a new long password");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({
      current: "correct horse battery",
      password: "a new long password",
    });
    // Nothing typed here is worth leaving on screen once it has landed.
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("never asks a Google-only account for a password it could not supply", async () => {
    vi.stubGlobal("fetch", ok());
    render(<PasswordForm hasPassword={false} />);
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set a password" })).toBeInTheDocument();
  });
});

describe("sharing", () => {
  it("turns the link off with a DELETE and stops showing it", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", sent);
    render(<Sharing token="abc123" />);
    expect(screen.getByLabelText("Your share link")).toHaveValue("http://localhost:3009/s/abc123");
    await userEvent.click(screen.getByRole("switch", { name: "Sharing" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/runs/share", { method: "DELETE" });
    expect(screen.queryByLabelText("Your share link")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Sharing" })).toHaveAttribute("aria-checked", "false");
  });

  it("turns it on and shows the link it was handed", async () => {
    vi.stubGlobal("fetch", ok({ token: "fresh99" }));
    render(<Sharing token={null} />);
    await userEvent.click(screen.getByRole("switch", { name: "Sharing" }));
    expect(screen.getByLabelText("Your share link")).toHaveValue("http://localhost:3009/s/fresh99");
  });
});

describe("signing out everywhere", () => {
  it("asks first, because it signs this browser out too", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", sent);
    render(<SignOutEverywhere />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(sent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, sign out" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/auth/logout/everywhere", { method: "POST" });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("takes cancel for an answer", async () => {
    const sent = vi.fn();
    vi.stubGlobal("fetch", sent);
    render(<SignOutEverywhere />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(sent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument();
  });
});
