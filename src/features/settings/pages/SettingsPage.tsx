import { useMemo, useState } from "react";
import { GraphShortcutGuide } from "../../workflows/components/GraphShortcutGuide";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { SwitchField } from "../../../components/ui/switch";
import type { CloakBrowserDiagnostics } from "../../../types/workflow";
import {
  formatDiagnosticsReadiness,
  redactLocalPaths,
  type DiagnosticsReadinessCard,
} from "./settingsDiagnosticsFormatters";

type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  diagnostics: CloakBrowserDiagnostics | null;
  diagnosticsLoading: boolean;
  diagnosticsError: string;
  maintenanceMessage: string;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
  onRefreshDiagnostics: () => void | Promise<void>;
  onInstallBinary: () => void | Promise<void>;
  onCleanupProfiles: () => void | Promise<void>;
};

type MaintenanceAction = "install" | "cleanup";

export function SettingsPage({
  graphAutosaveEnabled,
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  maintenanceMessage,
  onGraphAutosaveEnabledChange,
  onRefreshDiagnostics,
  onInstallBinary,
  onCleanupProfiles,
}: SettingsPageProps) {
  const [confirmAction, setConfirmAction] = useState<MaintenanceAction | null>(null);
  const [pendingAction, setPendingAction] = useState<MaintenanceAction | null>(null);
  const [maintenanceError, setMaintenanceError] = useState("");
  const readinessCards = useMemo(
    () => (diagnostics ? formatDiagnosticsReadiness(diagnostics) : []),
    [diagnostics],
  );

  async function confirmMaintenanceAction() {
    if (!confirmAction) return;
    setPendingAction(confirmAction);
    setMaintenanceError("");
    try {
      if (confirmAction === "install") {
        await onInstallBinary();
      } else {
        await onCleanupProfiles();
      }
      setConfirmAction(null);
    } catch (caught) {
      setMaintenanceError(redactLocalPaths(commandMessage(caught)));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="app-screen settings-screen" aria-label="Settings">
      <header className="app-header settings-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Settings</h1>
          <p className="muted">App preferences, local runtime readiness, and maintenance.</p>
        </div>
      </header>

      <div className="settings-workspace">
        <nav className="settings-section-nav" aria-label="Settings sections">
          <a href="#settings-graph-persistence">Graph Persistence</a>
          <a href="#settings-environment-readiness">Environment Readiness</a>
          <a href="#settings-maintenance">Maintenance</a>
          <a href="#settings-graph-shortcuts">Graph Shortcuts</a>
        </nav>

        <div className="settings-panel-stack">
          <GraphPersistencePanel
            graphAutosaveEnabled={graphAutosaveEnabled}
            onGraphAutosaveEnabledChange={onGraphAutosaveEnabledChange}
          />

          <EnvironmentReadinessPanel
            diagnostics={diagnostics}
            diagnosticsLoading={diagnosticsLoading}
            diagnosticsError={diagnosticsError}
            readinessCards={readinessCards}
            onRefreshDiagnostics={onRefreshDiagnostics}
          />

          <MaintenancePanel
            diagnostics={diagnostics}
            maintenanceMessage={maintenanceMessage}
            maintenanceError={maintenanceError}
            pendingAction={pendingAction}
            onInstall={() => {
              setMaintenanceError("");
              setConfirmAction("install");
            }}
            onCleanup={() => {
              setMaintenanceError("");
              setConfirmAction("cleanup");
            }}
          />

          <GraphShortcutsPanel />
        </div>
      </div>

      <MaintenanceConfirmDialog
        action={confirmAction}
        diagnostics={diagnostics}
        pending={pendingAction === confirmAction}
        error={maintenanceError}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          void confirmMaintenanceAction();
        }}
      />
    </section>
  );
}

function GraphPersistencePanel({
  graphAutosaveEnabled,
  onGraphAutosaveEnabledChange,
}: {
  graphAutosaveEnabled: boolean;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <section
      id="settings-graph-persistence"
      className="panel settings-panel"
      aria-label="Workflow editing settings"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Workflow Editing</p>
          <h2>Graph persistence</h2>
        </div>
        <span className="status-pill">
          {graphAutosaveEnabled ? "Autosave is on" : "Manual save is required"}
        </span>
      </div>

      <SwitchField
        id="graph-autosave-enabled"
        label="Autosave graph changes"
        description="Save graph edits after changes. Turn this off to use manual Save."
        checked={graphAutosaveEnabled}
        onCheckedChange={onGraphAutosaveEnabledChange}
      />
      <p className="muted">
        {graphAutosaveEnabled
          ? "Graph edits save after changes."
          : "Graph edits remain unsaved until you choose Save in the workflow detail."}
      </p>
    </section>
  );
}

function EnvironmentReadinessPanel({
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  readinessCards,
  onRefreshDiagnostics,
}: {
  diagnostics: CloakBrowserDiagnostics | null;
  diagnosticsLoading: boolean;
  diagnosticsError: string;
  readinessCards: DiagnosticsReadinessCard[];
  onRefreshDiagnostics: () => void | Promise<void>;
}) {
  return (
    <section
      id="settings-environment-readiness"
      className="panel settings-panel"
      aria-label="Environment readiness"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>Environment readiness</h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={diagnosticsLoading}
          onClick={() => {
            void onRefreshDiagnostics();
          }}
        >
          {diagnosticsLoading && diagnostics ? "Refreshing..." : "Refresh Diagnostics"}
        </Button>
      </div>

      {diagnosticsError ? (
        <p className="field-error" role="alert">
          {redactLocalPaths(diagnosticsError)}
        </p>
      ) : null}
      {diagnosticsLoading && !diagnostics ? (
        <p className="muted">Loading diagnostics...</p>
      ) : null}
      {diagnostics ? (
        <div className="settings-readiness-grid">
          {readinessCards.map((card) => (
            <ReadinessItem key={card.label} card={card} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReadinessItem({ card }: { card: DiagnosticsReadinessCard }) {
  return (
    <div className={`settings-readiness-item settings-readiness-item-${card.tone}`}>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
      {card.details.length > 0 ? (
        <ul>
          {card.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MaintenancePanel({
  diagnostics,
  maintenanceMessage,
  maintenanceError,
  pendingAction,
  onInstall,
  onCleanup,
}: {
  diagnostics: CloakBrowserDiagnostics | null;
  maintenanceMessage: string;
  maintenanceError: string;
  pendingAction: MaintenanceAction | null;
  onInstall: () => void;
  onCleanup: () => void;
}) {
  const orphanCount =
    diagnostics?.profiles.filter((profile) => !profile.workflow_id && !profile.active_session).length ?? 0;
  return (
    <section id="settings-maintenance" className="panel settings-panel" aria-label="Maintenance">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>Maintenance</h2>
        </div>
      </div>

      <p className="muted">
        Maintenance commands operate only on the local lab runtime and orphaned inactive browser profiles.
      </p>
      <div className="settings-maintenance-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={Boolean(pendingAction)}
          onClick={onInstall}
        >
          {pendingAction === "install" ? "Installing..." : "Install CloakBrowser Binary"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={Boolean(pendingAction)}
          onClick={onCleanup}
        >
          {pendingAction === "cleanup" ? "Cleaning..." : "Cleanup Orphaned Profiles"}
        </Button>
      </div>
      <p className="settings-maintenance-hint">
        {orphanCount} orphaned {orphanCount === 1 ? "profile" : "profiles"} can be cleaned.
      </p>
      {maintenanceError ? (
        <p className="field-error" role="alert">
          {maintenanceError}
        </p>
      ) : null}
      {maintenanceMessage ? <p role="status">{maintenanceMessage}</p> : null}
    </section>
  );
}

function GraphShortcutsPanel() {
  return (
    <section id="settings-graph-shortcuts" className="panel settings-panel" aria-label="Graph shortcuts">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Workflow Editing</p>
          <h2>Graph shortcuts</h2>
        </div>
      </div>

      <GraphShortcutGuide />
    </section>
  );
}

function MaintenanceConfirmDialog({
  action,
  diagnostics,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  action: MaintenanceAction | null;
  diagnostics: CloakBrowserDiagnostics | null;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cleanupPreview = cleanupPreviewText(diagnostics);
  const isInstall = action === "install";
  return (
    <Dialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {action ? (
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {isInstall ? "Install CloakBrowser Binary" : "Cleanup Orphaned Profiles"}
            </DialogTitle>
            <DialogDescription>
              {isInstall
                ? "This installs or repairs the local CloakBrowser-managed browser runtime used by workflow runs. It does not change workflow settings."
                : "Delete only orphaned inactive browser profiles not attached to workflows and not held by retained sessions."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {!isInstall ? (
              <div className="settings-confirm-copy">
                <p>Workflows, evidence, settings, and active profiles are preserved.</p>
                <dl className="key-value-list">
                  <div>
                    <dt>Cleanup scope</dt>
                    <dd>{cleanupPreview.orphanLabel}</dd>
                  </div>
                  <div>
                    <dt>Preserved profiles</dt>
                    <dd>{cleanupPreview.preservedLabel}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={isInstall ? "primary" : "destructive"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? (isInstall ? "Installing..." : "Cleaning...") : isInstall ? "Install Binary" : "Cleanup Profiles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function cleanupPreviewText(diagnostics: CloakBrowserDiagnostics | null) {
  const orphanCount =
    diagnostics?.profiles.filter((profile) => !profile.workflow_id && !profile.active_session).length ?? 0;
  const preservedCount =
    diagnostics?.profiles.filter((profile) => profile.workflow_id || profile.active_session).length ?? 0;
  return {
    orphanLabel: `${orphanCount} orphaned ${orphanCount === 1 ? "profile" : "profiles"} can be cleaned`,
    preservedLabel: `${preservedCount} managed or active ${preservedCount === 1 ? "profile" : "profiles"}`,
  };
}

function commandMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}
