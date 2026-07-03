import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { CalendarClock, Folder, Gauge, Settings, ChevronDown, ChevronRight, Users, LogOut, User, Shield, Sliders, HelpCircle } from "lucide-react";
import type { AppScreen } from "../shared/types/workspaceContracts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";

type AppSidebarActiveItem = "overview" | "projects" | "schedules" | "settings" | "admin-users";

type AppSidebarProps = {
  activeItem: AppSidebarActiveItem;
  collapsed: boolean;
  onOpenOverview: () => void;
  onOpenProjects: () => void;
  onOpenSchedules: () => void;
  onOpenSettings: () => void;
  onOpenSettingsHelp: () => void;
  onOpenAdminUsers?: () => void;
  onLogout?: () => void;
  currentUser?: { email: string; role: string } | null;
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
  onOpenAdminUsers,
  onLogout,
  currentUser,
  onToggle,
  screen,
}: AppSidebarProps) {
  const [settingsExpanded, setSettingsExpanded] = useState(() => activeItem === "settings");
  const [adminExpanded, setAdminExpanded] = useState(() => activeItem === "admin-users");
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  useEffect(() => {
    if (activeItem === "settings") {
      setSettingsExpanded(true);
    }
    if (activeItem === "admin-users") {
      setAdminExpanded(true);
    }
  }, [activeItem]);

  return (
    <aside aria-label="Application sidebar" className="app-sidebar">
      <div className="sidebar-brand">
        <img className="sidebar-logo" src={appLogoSrc} alt="Tik Automation logo" />
        <span className="sidebar-title">Tik Automation</span>
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
                <Sliders aria-hidden="true" className="sidebar-submenu-item-icon" size={14} />
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
                <HelpCircle aria-hidden="true" className="sidebar-submenu-item-icon" size={14} />
                <span>Help</span>
              </Button>
            </div>
          )}
        </div>
        {currentUser && currentUser.role === "admin" && onOpenAdminUsers && (
          <div className="sidebar-collapsible-group">
            <Button
              className={
                activeItem === "admin-users"
                  ? "sidebar-nav-item sidebar-nav-item-active"
                  : "sidebar-nav-item"
              }
              variant="ghost"
              type="button"
              onClick={() => {
                setAdminExpanded(!adminExpanded);
              }}
            >
              <Shield aria-hidden="true" className="sidebar-item-icon" />
              <span style={{ flex: "1 1 auto", textAlign: "left" }}>Admin</span>
              {!collapsed && (
                adminExpanded ? (
                  <ChevronDown className="sidebar-chevron-icon" size={16} />
                ) : (
                  <ChevronRight className="sidebar-chevron-icon" size={16} />
                )
              )}
            </Button>
            {!collapsed && adminExpanded && (
              <div className="sidebar-submenu">
                <Button
                  className={
                    activeItem === "admin-users"
                      ? "sidebar-submenu-item sidebar-submenu-item-active"
                      : "sidebar-submenu-item"
                  }
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={onOpenAdminUsers}
                >
                  <Users aria-hidden="true" className="sidebar-submenu-item-icon" size={14} />
                  <span>Users</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="sidebar-footer">
        {currentUser && (
          <div className="sidebar-profile">
            <div className="sidebar-profile-info">
              <div className="sidebar-profile-avatar-container">
                <User aria-hidden="true" className="sidebar-profile-avatar" size={16} />
              </div>
              <div className="sidebar-profile-details">
                <span className="sidebar-profile-email">{currentUser.email}</span>
                <span className="sidebar-profile-role">{currentUser.role}</span>
              </div>
            </div>
            {onLogout && (
              <Button
                aria-label="Sign Out"
                className="sidebar-profile-logout"
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setIsLogoutDialogOpen(true)}
              >
                <LogOut aria-hidden="true" className="sidebar-profile-logout-icon" size={15} />
              </Button>
            )}
          </div>
        )}
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={collapsed ? "sidebar-toggle-collapsed" : "sidebar-toggle-expanded"}
          variant="secondary"
          type="button"
          onClick={onToggle}
        >
          <SidebarToggleIcon collapsed={collapsed} />
          {!collapsed && <span>Collapse Sidebar</span>}
        </Button>
      </div>
      {onLogout && (
        <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
          <DialogContent className="logout-confirmation-dialog">
            <DialogHeader>
              <DialogTitle>Confirm Sign Out</DialogTitle>
              <DialogDescription>
                Are you sure you want to sign out of your account?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsLogoutDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={() => {
                  setIsLogoutDialogOpen(false);
                  onLogout();
                }}
              >
                Sign Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </aside>
  );
}
