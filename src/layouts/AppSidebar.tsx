import { Button } from "../components/ui/button";
import { ListTree, Settings } from "lucide-react";

type AppSidebarActiveItem = "workflows" | "settings";

type AppSidebarProps = {
  activeItem: AppSidebarActiveItem;
  collapsed: boolean;
  onOpenSettings: () => void;
  onOpenWorkflows: () => void;
  onToggle: () => void;
};

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="sidebar-toggle-icon"
      data-testid="sidebar-toggle-icon"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      {collapsed ? (
        <path
          d="M7 4.5 11.5 9 7 13.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M11 4.5 6.5 9l4.5 4.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}

export function AppSidebar({
  activeItem,
  collapsed,
  onOpenSettings,
  onOpenWorkflows,
  onToggle,
}: AppSidebarProps) {
  return (
    <aside aria-label="Application sidebar" className="app-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark">W</span>
        <span className="sidebar-title">Workflow Manager</span>
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        <Button
          className={
            activeItem === "workflows"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenWorkflows}
        >
          <ListTree aria-hidden="true" className="sidebar-item-icon" />
          <span>Workflows</span>
        </Button>
        <Button
          className={
            activeItem === "settings"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenSettings}
        >
          <Settings aria-hidden="true" className="sidebar-item-icon" />
          <span>Settings</span>
        </Button>
      </nav>
      <Button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="sidebar-toggle"
        variant="secondary"
        size="icon"
        type="button"
        onClick={onToggle}
      >
        <SidebarToggleIcon collapsed={collapsed} />
      </Button>
    </aside>
  );
}
