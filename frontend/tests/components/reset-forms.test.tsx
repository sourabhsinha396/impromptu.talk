import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForgotForm } from "@/components/auth/forgot-form";
import { ResetForm } from "@/components/auth/reset-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("the forgot form", () => {
  it("posts the address and says the same sentence whatever the answer was", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", sent);
    render(<ForgotForm />);
    await userEvent.type(screen.getByLabelText("Email"), "priya@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({ email: "priya@example.com" });
    expect(await screen.findByRole("status")).toHaveTextContent("If that address has an account, a link is on its way.");
    expect(screen.getByLabelText("Email")).toHaveValue("priya@example.com");
  });
});

describe("the reset form", () => {
  it("posts the token with the password and lands on the tool signed in", async () => {
    const sent = vi.fn().mockResolvedValue(new Response(JSON.stringify({ email: "priya@example.com" }), { status: 200 }));
    vi.stubGlobal("fetch", sent);
    render(<ResetForm token="Mg.abc-def" />);
    await userEvent.type(screen.getByLabelText("New password"), "a brand new password");
    await userEvent.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/auth/reset", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({ token: "Mg.abc-def", password: "a brand new password" });
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  it("prints the dead-link sentence and stays put", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "That link has expired or has already been used." }), { status: 400 }),
      ),
    );
    render(<ResetForm token="Mg.dead" />);
    await userEvent.type(screen.getByLabelText("New password"), "a brand new password");
    await userEvent.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That link has expired or has already been used.");
    expect(push).not.toHaveBeenCalled();
  });
});
