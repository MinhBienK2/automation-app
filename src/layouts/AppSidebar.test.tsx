import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";

describe("AppSidebar user profile and logout", () => {
  const defaultProps = {
    activeItem: "overview" as const,
    collapsed: false,
    onOpenOverview: vi.fn(),
    onOpenProjects: vi.fn(),
    onOpenSchedules: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenSettingsHelp: vi.fn(),
    onToggle: vi.fn(),
    screen: "overview" as const,
  };

  test("does not render Sign Out button in main navigation menu", () => {
    const currentUser = { email: "user@example.com", role: "user" };
    render(
      <AppSidebar
        {...defaultProps}
        currentUser={currentUser}
        onLogout={vi.fn()}
      />
    );

    const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
    const signOutBtn = screen.queryByRole("button", { name: /sign out/i });

    // The Sign Out button should NOT be inside the main navigation anymore
    if (signOutBtn) {
      expect(mainNav).not.toContainElement(signOutBtn);
    }
  });

  test("renders user profile section at the bottom when currentUser is present", () => {
    const currentUser = { email: "user@example.com", role: "user" };
    render(
      <AppSidebar
        {...defaultProps}
        currentUser={currentUser}
        onLogout={vi.fn()}
      />
    );

    // Should display the user email
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    
    // Should render a sign-out/logout button
    const logoutBtn = screen.getByRole("button", { name: /sign out/i });
    expect(logoutBtn).toBeInTheDocument();
  });

  test("does not render user profile section when currentUser is null", () => {
    render(<AppSidebar {...defaultProps} currentUser={null} />);

    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  test("calls onLogout when clicking the logout button", async () => {
    const currentUser = { email: "user@example.com", role: "user" };
    const onLogout = vi.fn();
    render(
      <AppSidebar
        {...defaultProps}
        currentUser={currentUser}
        onLogout={onLogout}
      />
    );

    const logoutBtn = screen.getByRole("button", { name: /sign out/i });
    await userEvent.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
