import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

type AppShellProps = {
  children: ReactNode;
  sidebarCollapsed: boolean;
  onBackToList: () => void;
  onToggleSidebar: () => void;
};

export function AppShell({
  children,
  sidebarCollapsed,
  onBackToList,
  onToggleSidebar,
}: AppShellProps) {
  return (
    <main className={sidebarCollapsed ? "app-shell app-shell-collapsed" : "app-shell"}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        onBackToList={onBackToList}
        onToggle={onToggleSidebar}
      />

      <section aria-label="Application content" className="app-content" role="region">
        {children}
      </section>
    </main>
  );
}
