import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import type { AppScreen } from "../shared/types/workspaceContracts";

type AppShellProps = {
  children: ReactNode;
  activeItem: "overview" | "projects" | "schedules" | "settings";
  sidebarCollapsed: boolean;
  onOpenOverview: () => void;
  onOpenProjects: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenSettingsHelp: () => void;
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
        onToggle={onToggleSidebar}
        screen={screen}
      />

      <section aria-label="Application content" className="app-content" role="region">
        {children}
      </section>
    </main>
  );
}
