import { Button } from "../components/ui/button";
import { Activity, CalendarClock, Files, Fingerprint, Gauge, ListTree, Settings } from "lucide-react";

type AppSidebarActiveItem = "overview" | "workflows" | "runs" | "evidence" | "schedules" | "identities" | "settings";

type AppSidebarProps = {
  activeItem: AppSidebarActiveItem;
  collapsed: boolean;
  onOpenOverview: () => void;
  onOpenEvidence: () => void;
  onOpenIdentities: () => void;
  onOpenRunCenter: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenWorkflows: () => void;
  onToggle: () => void;
};

const appLogoSrc = `${import.meta.env.BASE_URL}app-logo.svg`;

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
  onOpenOverview,
  onOpenEvidence,
  onOpenIdentities,
  onOpenRunCenter,
  onOpenSchedules,
  onOpenSettings,
  onOpenWorkflows,
  onToggle,
}: AppSidebarProps) {
  return (
    <aside aria-label="Application sidebar" className="app-sidebar">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={appLogoSrc} alt="Mission Control logo" />
        <span className="sidebar-title">Mission Control</span>
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        <Button
          className={
            activeItem === "overview"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenOverview}
        >
          <Gauge aria-hidden="true" className="sidebar-item-icon" />
          <span>Overview</span>
        </Button>
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
            activeItem === "runs"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenRunCenter}
        >
          <Activity aria-hidden="true" className="sidebar-item-icon" />
          <span>Runs</span>
        </Button>
        <Button
          className={
            activeItem === "evidence"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenEvidence}
        >
          <Files aria-hidden="true" className="sidebar-item-icon" />
          <span>Evidence</span>
        </Button>
        <Button
          className={
            activeItem === "schedules"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenSchedules}
        >
          <CalendarClock aria-hidden="true" className="sidebar-item-icon" />
          <span>Schedules</span>
        </Button>
        <Button
          className={
            activeItem === "identities"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="secondary"
          type="button"
          onClick={onOpenIdentities}
        >
          <Fingerprint aria-hidden="true" className="sidebar-item-icon" />
          <span>Identities</span>
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
