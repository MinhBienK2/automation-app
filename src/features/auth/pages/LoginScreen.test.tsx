import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen remember credentials feature", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders a 'Remember' checkbox that defaults to checked", () => {
    render(
      <LoginScreen
        onLogin={vi.fn().mockResolvedValue(true)}
        authError={null}
        isLoading={false}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: /remember/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  test("pre-fills remembered email on mount and defaults password without storing it", () => {
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("remembered_email", "user@example.com");
    localStorage.setItem("remembered_password", "password123");

    render(
      <LoginScreen
        onLogin={vi.fn().mockResolvedValue(true)}
        authError={null}
        isLoading={false}
      />
    );

    expect(screen.getByLabelText(/email address/i)).toHaveValue("user@example.com");
    expect(screen.getByLabelText(/password/i)).toHaveValue("admin");
    expect(screen.getByRole("checkbox", { name: /remember/i })).toBeChecked();
  });

  test("saves email to localStorage on submit when remember stays checked but never stores password", async () => {
    const onLogin = vi.fn().mockResolvedValue(true);
    render(
      <LoginScreen
        onLogin={onLogin}
        authError={null}
        isLoading={false}
      />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "newuser@example.com");
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, "newpassword");
    await userEvent.click(submitBtn);
    expect(onLogin).toHaveBeenCalledWith("newuser@example.com", "newpassword");
    expect(localStorage.getItem("remember_me")).toBe("true");
    expect(localStorage.getItem("remembered_email")).toBe("newuser@example.com");
    expect(localStorage.getItem("remembered_password")).toBeNull();
  });

  test("clears stored email if remember is unchecked before submit", async () => {
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("remembered_email", "olduser@example.com");
    localStorage.setItem("remembered_password", "oldpassword");

    const onLogin = vi.fn().mockResolvedValue(true);
    render(
      <LoginScreen
        onLogin={onLogin}
        authError={null}
        isLoading={false}
      />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const checkbox = screen.getByRole("checkbox", { name: /remember/i });
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    // Remember defaults to checked now — uncheck it explicitly.
    await userEvent.click(checkbox);

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "another@example.com");
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, "oldpassword");

    await userEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("another@example.com", "oldpassword");
    expect(localStorage.getItem("remember_me")).toBeNull();
    expect(localStorage.getItem("remembered_email")).toBeNull();
    expect(localStorage.getItem("remembered_password")).toBeNull();
  });
});
