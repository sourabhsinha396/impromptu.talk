import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

const ok = () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ email: "priya@example.com" }), { status: 200 }));
const refused = (detail: string) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 400 }));

async function signIn() {
  await userEvent.type(screen.getByLabelText("Email"), "priya@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("the sign-in form", () => {
  it("posts the pair, then goes where the person was going and redraws the chrome", async () => {
    const sent = ok();
    vi.stubGlobal("fetch", sent);
    render(<LoginForm next="/streak" />);
    await signIn();
    expect(sent).toHaveBeenCalledWith("/api/v1/auth/login", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({
      email: "priya@example.com",
      password: "correct horse battery",
      recaptcha_token: "",
    });
    expect(push).toHaveBeenCalledWith("/streak");
    expect(refresh).toHaveBeenCalled();
  });

  it("prints the backend's one sentence above the form and keeps the typing", async () => {
    vi.stubGlobal("fetch", refused("That email and password do not match."));
    render(<LoginForm next="/" />);
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match.");
    expect(screen.getByLabelText("Email")).toHaveValue("priya@example.com");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("puts the way out beside the password, where the person is looking", () => {
    render(<LoginForm next="/" />);
    expect(screen.getByRole("link", { name: "Forgotten?" })).toHaveAttribute("href", "/forgot");
  });
});

describe("the sign-up form", () => {
  it("posts the name, address and password and lands where asked", async () => {
    const sent = ok();
    vi.stubGlobal("fetch", sent);
    render(<SignupForm next="/pro" />);
    await userEvent.type(screen.getByLabelText("Name"), "Priya");
    await userEvent.type(screen.getByLabelText("Email"), "priya@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(sent).toHaveBeenCalledWith("/api/v1/auth/signup", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(sent.mock.calls[0][1]?.body))).toEqual({
      name: "Priya",
      email: "priya@example.com",
      password: "correct horse battery",
      recaptcha_token: "",
    });
    expect(push).toHaveBeenCalledWith("/pro");
  });

  it("says a name is optional and holds it to eighty characters", () => {
    render(<SignupForm next="/" />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("maxlength", "80");
  });
});
