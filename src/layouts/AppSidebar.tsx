import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { CalendarClock, Folder, Gauge, Settings, ChevronDown, ChevronRight } from "lucide-react";
import type { AppScreen } from "../shared/types/workspaceContracts";

type AppSidebarActiveItem = "overview" | "projects" | "schedules" | "settings";

type AppSidebarProps = {
  activeItem: AppSidebarActiveItem;
  collapsed: boolean;
  onOpenOverview: () => void;
  onOpenProjects: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenSettingsHelp: () => void;
  onToggle: () => void;
  screen: AppScreen;
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
  onOpenProjects,
  onOpenSchedules,
  onOpenSettings,
  onOpenSettingsHelp,
  onToggle,
  screen,
}: AppSidebarProps) {
  const [settingsExpanded, setSettingsExpanded] = useState(() => activeItem === "settings");

  useEffect(() => {
    if (activeItem === "settings") {
      setSettingsExpanded(true);
    }
  }, [activeItem]);

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
          variant="ghost"
          type="button"
          onClick={onOpenOverview}
        >
          <Gauge aria-hidden="true" className="sidebar-item-icon" />
          <span>Overview</span>
        </Button>
        <Button
          className={
            activeItem === "projects"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="ghost"
          type="button"
          onClick={onOpenProjects}
        >
          <Folder aria-hidden="true" className="sidebar-item-icon" />
          <span>Projects</span>
        </Button>

        <Button
          className={
            activeItem === "schedules"
              ? "sidebar-nav-item sidebar-nav-item-active"
              : "sidebar-nav-item"
          }
          variant="ghost"
          type="button"
          onClick={onOpenSchedules}
        >
          <CalendarClock aria-hidden="true" className="sidebar-item-icon" />
          <span>Schedules</span>
        </Button>
        <div className="sidebar-collapsible-group">
          <Button
            className={
              activeItem === "settings"
                ? "sidebar-nav-item sidebar-nav-item-active"
                : "sidebar-nav-item"
            }
            variant="ghost"
            type="button"
            onClick={() => {
              setSettingsExpanded(!settingsExpanded);
              if (activeItem !== "settings") {
                onOpenSettings();
              }
            }}
          >
            <Settings aria-hidden="true" className="sidebar-item-icon" />
            <span style={{ flex: "1 1 auto", textAlign: "left" }}>Setting</span>
            {!collapsed && (
              settingsExpanded ? (
                <ChevronDown className="sidebar-chevron-icon" size={16} />
              ) : (
                <ChevronRight className="sidebar-chevron-icon" size={16} />
              )
            )}
          </Button>
          {!collapsed && settingsExpanded && (
            <div className="sidebar-submenu">
              <Button
                className={
                  screen === "settings"
                    ? "sidebar-submenu-item sidebar-submenu-item-active"
                    : "sidebar-submenu-item"
                }
                variant="ghost"
                size="sm"
                type="button"
                onClick={onOpenSettings}
              >
                <span>General</span>
              </Button>
              <Button
                className={
                  screen === "settings-help"
                    ? "sidebar-submenu-item sidebar-submenu-item-active"
                    : "sidebar-submenu-item"
                }
                variant="ghost"
                size="sm"
                type="button"
                onClick={onOpenSettingsHelp}
              >
                <span>Help</span>
              </Button>
            </div>
          )}
        </div>
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
