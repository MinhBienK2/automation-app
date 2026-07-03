import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen remember credentials feature", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders a 'Remember credentials' checkbox", () => {
    render(
      <LoginScreen
        onLogin={vi.fn().mockResolvedValue(true)}
        authError={null}
        isLoading={false}
        onPrivate={vi.fn()}
        pgAvailable={true}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: /remember credentials/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test("pre-fills email and password fields on mount when remember_me is true", () => {
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("remembered_email", "user@example.com");
    localStorage.setItem("remembered_password", "password123");

    render(
      <LoginScreen
        onLogin={vi.fn().mockResolvedValue(true)}
        authError={null}
        isLoading={false}
        onPrivate={vi.fn()}
        pgAvailable={true}
      />
    );

    expect(screen.getByLabelText(/email address/i)).toHaveValue("user@example.com");
    expect(screen.getByLabelText(/password/i)).toHaveValue("password123");
    expect(screen.getByRole("checkbox", { name: /remember credentials/i })).toBeChecked();
  });

  test("saves credentials to localStorage on submit if checkbox is checked", async () => {
    const onLogin = vi.fn().mockResolvedValue(true);
    render(
      <LoginScreen
        onLogin={onLogin}
        authError={null}
        isLoading={false}
        onPrivate={vi.fn()}
        pgAvailable={true}
      />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const checkbox = screen.getByRole("checkbox", { name: /remember credentials/i });
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    await userEvent.type(emailInput, "newuser@example.com");
    await userEvent.type(passwordInput, "newpassword");
    await userEvent.click(checkbox);
    await userEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("newuser@example.com", "newpassword");
    expect(localStorage.getItem("remember_me")).toBe("true");
    expect(localStorage.getItem("remembered_email")).toBe("newuser@example.com");
    expect(localStorage.getItem("remembered_password")).toBe("newpassword");
  });

  test("clears stored credentials if checkbox is not checked on submit", async () => {
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("remembered_email", "olduser@example.com");
    localStorage.setItem("remembered_password", "oldpassword");

    const onLogin = vi.fn().mockResolvedValue(true);
    render(
      <LoginScreen
        onLogin={onLogin}
        authError={null}
        isLoading={false}
        onPrivate={vi.fn()}
        pgAvailable={true}
      />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const checkbox = screen.getByRole("checkbox", { name: /remember credentials/i });
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    // Uncheck remember me
    await userEvent.click(checkbox);

    // Change email
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "another@example.com");

    await userEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("another@example.com", "oldpassword");
    expect(localStorage.getItem("remember_me")).toBeNull();
    expect(localStorage.getItem("remembered_email")).toBeNull();
    expect(localStorage.getItem("remembered_password")).toBeNull();
  });
});
