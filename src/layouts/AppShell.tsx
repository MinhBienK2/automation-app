import type { ReactNode } from "react";
import { Bell, Search, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AppSidebar } from "./AppSidebar";
import type { CommandSearchResult } from "../types/workflow";

type AppShellProps = {
  children: ReactNode;
  activeItem: "overview" | "workflows" | "runs" | "evidence" | "schedules" | "identities" | "settings";
  sidebarCollapsed: boolean;
  commandSearchQuery: string;
  commandSearchResults: CommandSearchResult[];
  alertCount: number;
  onCommandSearchQueryChange: (query: string) => void;
  onCommandSearchResultSelect: (result: CommandSearchResult) => void;
  onOpenAlerts: () => void;
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
  alertCount,
  children,
  commandSearchQuery,
  commandSearchResults,
  sidebarCollapsed,
  onCommandSearchQueryChange,
  onCommandSearchResultSelect,
  onOpenAlerts,
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
        <header className="shell-command-bar" aria-label="Mission Control command bar">
          <div className="shell-context">
            <span>{activeItemLabel(activeItem)}</span>
            <small>
              <ShieldCheck aria-hidden="true" />
              Local Lab
            </small>
          </div>
          <div className="command-search" role="search">
            <Search aria-hidden="true" className="command-search-icon" />
            <Input
              aria-label="Search Mission Control"
              type="search"
              value={commandSearchQuery}
              placeholder="Search workflows, runs, evidence, schedules, identities"
              onChange={(event) => onCommandSearchQueryChange(event.currentTarget.value)}
            />
            {commandSearchQuery.trim().length >= 2 ? (
              <div className="command-search-results" aria-label="Mission Control search results">
                {commandSearchResults.length ? (
                  commandSearchResults.map((result) => (
                    <button
                      key={result.id}
                      className="command-search-result"
                      type="button"
                      aria-label={`${result.type} ${result.label}${
                        result.context ? ` ${result.context}` : ""
                      }`}
                      onClick={() => onCommandSearchResultSelect(result)}
                    >
                      <span>{result.type}</span>
                      <strong>{result.label}</strong>
                      {result.context ? <small>{result.context}</small> : null}
                    </button>
                  ))
                ) : (
                  <p className="command-search-empty">No matching Mission Control records</p>
                )}
              </div>
            ) : null}
          </div>
          <Button
            aria-label="Alerts"
            className="shell-alert-button"
            type="button"
            variant={alertCount > 0 ? "default" : "secondary"}
            onClick={onOpenAlerts}
          >
            <Bell aria-hidden="true" />
            <span>Alerts</span>
            {alertCount > 0 ? <strong aria-hidden="true">{alertCount}</strong> : null}
          </Button>
        </header>
        {children}
      </section>
    </main>
  );
}

function activeItemLabel(activeItem: AppShellProps["activeItem"]) {
  switch (activeItem) {
    case "overview":
      return "Overview";
    case "workflows":
      return "Workflows";
    case "runs":
      return "Runs";
    case "evidence":
      return "Evidence";
    case "schedules":
      return "Schedules";
    case "identities":
      return "Identities";
    case "settings":
      return "Settings";
  }
}
