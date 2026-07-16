import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen remember credentials feature", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders a 'Remember email' checkbox", () => {
    render(
      <LoginScreen
        onLogin={vi.fn().mockResolvedValue(true)}
        authError={null}
        isLoading={false}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: /remember/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test("pre-fills email field on mount when remember_me is true but does not prefill password", () => {
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
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: /remember/i })).toBeChecked();
  });

  test("saves email to localStorage on submit if checkbox is checked but not password", async () => {
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

    await userEvent.type(emailInput, "newuser@example.com");
    await userEvent.type(passwordInput, "newpassword");
    await userEvent.click(checkbox);
    await userEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("newuser@example.com", "newpassword");
    expect(localStorage.getItem("remember_me")).toBe("true");
    expect(localStorage.getItem("remembered_email")).toBe("newuser@example.com");
    expect(localStorage.getItem("remembered_password")).toBeNull();
  });

  test("clears stored email if checkbox is not checked on submit", async () => {
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

    // Uncheck remember me
    await userEvent.click(checkbox);

    // Change email and type password
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "another@example.com");
    await userEvent.type(passwordInput, "oldpassword");

    await userEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("another@example.com", "oldpassword");
    expect(localStorage.getItem("remember_me")).toBeNull();
    expect(localStorage.getItem("remembered_email")).toBeNull();
    expect(localStorage.getItem("remembered_password")).toBeNull();
  });
});
