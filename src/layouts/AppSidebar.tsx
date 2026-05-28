import { Button } from "../components/ui/button";
import { Activity, CalendarClock, Files, Fingerprint, Gauge, ListTree, Settings } from "lucide-react";
import {
  missionControlNavItems,
  type MissionControlNavItemId,
} from "../lib/missionControlNavigation";

type AppSidebarActiveItem = MissionControlNavItemId;

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
const sidebarIcons = {
  overview: Gauge,
  workflows: ListTree,
  runs: Activity,
  evidence: Files,
  schedules: CalendarClock,
  identities: Fingerprint,
  settings: Settings,
} satisfies Record<MissionControlNavItemId, typeof Gauge>;

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
  const handlers = {
    overview: onOpenOverview,
    workflows: onOpenWorkflows,
    runs: onOpenRunCenter,
    evidence: onOpenEvidence,
    schedules: onOpenSchedules,
    identities: onOpenIdentities,
    settings: onOpenSettings,
  } satisfies Record<MissionControlNavItemId, () => void>;

  return (
    <aside aria-label="Application sidebar" className="app-sidebar">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={appLogoSrc} alt="Mission Control logo" />
        <span className="sidebar-title">Mission Control</span>
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {missionControlNavItems.map((item) => {
          const Icon = sidebarIcons[item.id];
          return (
            <Button
              key={item.id}
              aria-label={collapsed ? item.ariaLabel : undefined}
              className={
                activeItem === item.id
                  ? "sidebar-nav-item sidebar-nav-item-active"
                  : "sidebar-nav-item"
              }
              data-tooltip={collapsed ? item.label : undefined}
              variant="secondary"
              type="button"
              onClick={handlers[item.id]}
            >
              <Icon aria-hidden="true" className="sidebar-item-icon" />
              <span>{item.label}</span>
            </Button>
          );
        })}
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
