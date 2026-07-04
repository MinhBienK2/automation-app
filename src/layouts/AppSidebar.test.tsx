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

  test("opens logout confirmation dialog, does not call onLogout when cancelled", async () => {
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

    // Verify dialog is visible
    expect(screen.getByText(/Are you sure you want to sign out/i)).toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Dialog should be closed
    expect(screen.queryByText(/Are you sure you want to sign out/i)).not.toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();
  });

  test("opens logout confirmation dialog, calls onLogout when confirmed", async () => {
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

    expect(screen.getByText(/Are you sure you want to sign out/i)).toBeInTheDocument();

    // The sidebar logout button becomes aria-hidden, so getByRole("button", { name: "Sign Out" })
    // will query only the confirm button in the dialog.
    const confirmBtn = screen.getByRole("button", { name: "Sign Out" });
    await userEvent.click(confirmBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Are you sure you want to sign out/i)).not.toBeInTheDocument();
  });

  test("renders collapsible Admin menu and submenus for admin users", async () => {
    const currentUser = { email: "admin@example.com", role: "admin" };
    const onOpenAdminUsers = vi.fn();
    render(
      <AppSidebar
        {...defaultProps}
        currentUser={currentUser}
        onOpenAdminUsers={onOpenAdminUsers}
      />
    );

    // Should render Admin menu item
    const adminMenuBtn = screen.getByRole("button", { name: /admin/i });
    expect(adminMenuBtn).toBeInTheDocument();

    // Since activeItem is "overview", the submenu "Users" should not be visible initially
    expect(screen.queryByRole("button", { name: /users/i })).not.toBeInTheDocument();

    // Click Admin menu to expand
    await userEvent.click(adminMenuBtn);

    // Now the "Users" submenu button should be visible
    const usersSubmenuBtn = screen.getByRole("button", { name: /users/i });
    expect(usersSubmenuBtn).toBeInTheDocument();

    // Clicking Users should trigger onOpenAdminUsers
    await userEvent.click(usersSubmenuBtn);
    expect(onOpenAdminUsers).toHaveBeenCalledTimes(1);
  });
});

