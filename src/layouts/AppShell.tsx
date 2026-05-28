import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

type AppShellProps = {
  children: ReactNode;
  activeItem: "overview" | "workflows" | "runs" | "evidence" | "schedules" | "identities" | "settings";
  sidebarCollapsed: boolean;
  onOpenOverview: () => void;
  onOpenEvidence: () => void;
  onOpenIdentities: () => void;
  onOpenRunCenter: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenWorkflows: () => void;
  onToggleSidebar: () => void;
};

export function AppShell({
  activeItem,
  children,
  sidebarCollapsed,
  onOpenOverview,
  onOpenEvidence,
  onOpenIdentities,
  onOpenSchedules,
  onOpenRunCenter,
  onOpenSettings,
  onOpenWorkflows,
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
        onOpenSchedules={onOpenSchedules}
        onOpenRunCenter={onOpenRunCenter}
        onOpenSettings={onOpenSettings}
        onOpenWorkflows={onOpenWorkflows}
        onToggle={onToggleSidebar}
      />

      <section aria-label="Application content" className="app-content" role="region">
        {children}
      </section>
    </main>
  );
}
