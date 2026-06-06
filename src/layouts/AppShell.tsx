import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

type AppShellProps = {
  children: ReactNode;
  activeItem: "overview" | "projects" | "runs" | "evidence" | "schedules" | "identities" | "settings";
  sidebarCollapsed: boolean;
  onOpenOverview: () => void;
  onOpenEvidence: () => void;
  onOpenIdentities: () => void;
  onOpenProjects: () => void;
  onOpenRunCenter: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
};

export function AppShell({
  activeItem,
  children,
  sidebarCollapsed,
  onOpenOverview,
  onOpenEvidence,
  onOpenIdentities,
  onOpenProjects,
  onOpenSchedules,
  onOpenRunCenter,
  onOpenSettings,
  onToggleSidebar,
}: AppShellProps) {
  return (
    <main className={sidebarCollapsed ? "app-shell app-shell-collapsed" : "app-shell"}>
      <AppSidebar
        activeItem={activeItem}
        collapsed={sidebarCollapsed}
        onOpenOverview={onOpenOverview}
        onOpenEvidence={onOpenEvidence}
        onOpenIdentities={onOpenIdentities}
        onOpenProjects={onOpenProjects}
        onOpenSchedules={onOpenSchedules}
        onOpenRunCenter={onOpenRunCenter}
        onOpenSettings={onOpenSettings}
        onToggle={onToggleSidebar}
      />

      <section aria-label="Application content" className="app-content" role="region">
        {children}
      </section>
    </main>
  );
}
