import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Bell, Search, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  AlertPreviewPopover,
  type AlertPreviewItem,
} from "../components/patterns/AlertPreviewPopover";
import { CommandPalette } from "../components/patterns/CommandPalette";
import type { CommandSearchResultGroup } from "../lib/commandSearch";
import {
  isInputLikeShortcutTarget,
  type MissionControlNavItemId,
} from "../lib/missionControlNavigation";
import { AppSidebar } from "./AppSidebar";
import type { CommandSearchResult } from "../types/workflow";

type AppShellProps = {
  children: ReactNode;
  activeItem: MissionControlNavItemId;
  sidebarCollapsed: boolean;
  commandSearchQuery: string;
  commandSearchGroups: CommandSearchResultGroup[];
  commandSearchLoading: boolean;
  commandSearchError: string | null;
  alertCount: number;
  alertItems: AlertPreviewItem[];
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
  commandSearchGroups,
  commandSearchLoading,
  commandSearchError,
  alertItems,
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const commandSearchRef = useRef<HTMLDivElement | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const flatCommandResults = useMemo(
    () => commandSearchGroups.flatMap((group) => group.results),
    [commandSearchGroups],
  );
  const activeCommandResult = flatCommandResults[activeCommandIndex] ?? flatCommandResults[0] ?? null;

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandSearchQuery, commandSearchGroups]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node) {
        if (!commandSearchRef.current?.contains(target)) setCommandPaletteOpen(false);
        if (!alertRef.current?.contains(target)) setAlertsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (isInputLikeShortcutTarget(event.target)) return;
      if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setCommandPaletteOpen(true);
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  function selectCommandResult(result: CommandSearchResult) {
    setCommandPaletteOpen(false);
    onCommandSearchResultSelect(result);
  }

  function handleCommandKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setCommandPaletteOpen(false);
      return;
    }
    if (!flatCommandResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCommandIndex((current) => (current + 1) % flatCommandResults.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommandIndex((current) =>
        current === 0 ? flatCommandResults.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = activeCommandResult ?? flatCommandResults[0] ?? null;
      if (result) selectCommandResult(result);
    }
  }

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
          <div className="command-search" role="search" ref={commandSearchRef}>
            <Search aria-hidden="true" className="command-search-icon" />
            <Input
              ref={searchInputRef}
              aria-label="Search Mission Control"
              type="search"
              value={commandSearchQuery}
              placeholder="Search workflows, runs, evidence, schedules, identities"
              onFocus={() => setCommandPaletteOpen(true)}
              onKeyDown={handleCommandKeyDown}
              onChange={(event) => {
                onCommandSearchQueryChange(event.currentTarget.value);
                setCommandPaletteOpen(true);
              }}
            />
            {commandPaletteOpen ? (
              <CommandPalette
                query={commandSearchQuery}
                groups={commandSearchGroups}
                loading={commandSearchLoading}
                error={commandSearchError}
                activeResultId={activeCommandResult?.id ?? null}
                onSelect={selectCommandResult}
              />
            ) : null}
          </div>
          <div className="shell-alert-wrap" ref={alertRef}>
            <Button
              aria-label={alertCount > 0 ? `Alerts ${alertCount}` : "Alerts"}
              className="shell-alert-button"
              type="button"
              variant={alertCount > 0 ? "default" : "secondary"}
              onClick={() => setAlertsOpen((open) => !open)}
            >
              <Bell aria-hidden="true" />
              <span>Alerts</span>
              {alertCount > 0 ? <strong aria-hidden="true">{alertCount}</strong> : null}
            </Button>
            {alertsOpen ? (
              <AlertPreviewPopover
                items={alertItems}
                onClose={() => setAlertsOpen(false)}
                onOpenAttentionQueue={() => {
                  setAlertsOpen(false);
                  onOpenAlerts();
                }}
              />
            ) : null}
          </div>
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
