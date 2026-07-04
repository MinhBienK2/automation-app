import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import type { AppScreen } from "../shared/types/workspaceContracts";

type AppShellProps = {
  children: ReactNode;
  activeItem: "overview" | "projects" | "schedules" | "settings" | "admin-users";
  sidebarCollapsed: boolean;
  onOpenOverview: () => void;
  onOpenProjects: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenSettingsHelp: () => void;
  onOpenAdminUsers?: () => void;
  onLogout?: () => void;
  currentUser?: { email: string; role: string } | null;
  onToggleSidebar: () => void;
  screen: AppScreen;
};

export function AppShell({
  activeItem,
  children,
  sidebarCollapsed,
  onOpenOverview,
  onOpenProjects,
  onOpenSchedules,
  onOpenSettings,
  onOpenSettingsHelp,
  onOpenAdminUsers,
  onLogout,
  currentUser,
  onToggleSidebar,
  screen,
}: AppShellProps) {
  return (
    <main className={sidebarCollapsed ? "app-shell app-shell-collapsed" : "app-shell"}>
      <AppSidebar
        activeItem={activeItem}
        collapsed={sidebarCollapsed}
        onOpenOverview={onOpenOverview}
        onOpenProjects={onOpenProjects}
        onOpenSchedules={onOpenSchedules}
        onOpenSettings={onOpenSettings}
        onOpenSettingsHelp={onOpenSettingsHelp}
        onOpenAdminUsers={onOpenAdminUsers}
        onLogout={onLogout}
        currentUser={currentUser}
        onToggle={onToggleSidebar}
        screen={screen}
      />

      <section aria-label="Application content" className="app-content" role="region">
        {children}
      </section>
    </main>
  );
}
