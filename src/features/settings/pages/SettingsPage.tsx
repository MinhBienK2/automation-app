import { GraphShortcutGuide } from "../../workflows/components/GraphShortcutGuide";
import { Button } from "../../../components/ui/button";
import { SwitchField } from "../../../components/ui/switch";
import type { CloakBrowserDiagnostics } from "../../../types/workflow";

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
  return (
    <section className="app-screen settings-screen" aria-label="Settings">
      <header className="app-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>App Settings</h1>
        </div>
      </header>

      <section className="panel settings-panel" aria-label="Workflow editing settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph persistence</h2>
          </div>
        </div>

        <SwitchField
          id="graph-autosave-enabled"
          label="Autosave graph changes"
          description="Save graph edits after changes. Turn this off to use manual Save."
          checked={graphAutosaveEnabled}
          onCheckedChange={onGraphAutosaveEnabledChange}
        />
      </section>

      <section className="panel settings-panel" aria-label="Environment readiness">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2>Environment readiness</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onRefreshDiagnostics();
            }}
          >
            Refresh Diagnostics
          </Button>
        </div>

        {diagnosticsError ? (
          <p className="field-error" role="alert">
            {diagnosticsError}
          </p>
        ) : null}
        {diagnosticsLoading && !diagnostics ? (
          <p className="muted">Loading diagnostics...</p>
        ) : null}
        {diagnostics ? (
          <div className="settings-readiness-grid">
            <ReadinessItem
              label="CloakBrowser"
              value={
                diagnostics.binary.installed
                  ? `Installed${diagnostics.binary.version ? ` ${diagnostics.binary.version}` : ""}`
                  : "Not installed"
              }
              tone={diagnostics.binary.installed ? "ready" : "attention"}
            />
            <ReadinessItem
              label="GeoIP"
              value={diagnostics.geoip_available ? "GeoIP available" : "GeoIP unavailable"}
              tone={diagnostics.geoip_available ? "ready" : "attention"}
            />
            <ReadinessItem
              label="Headed display"
              value={diagnostics.headed_display.available ? "Available" : "Unavailable"}
              tone={diagnostics.headed_display.available ? "ready" : "attention"}
            />
            <ReadinessItem
              label="Fingerprint fonts"
              value={statusLabel(diagnostics.font_checklist.status)}
              tone={diagnostics.font_checklist.status === "error" ? "attention" : "ready"}
            />
            <ReadinessItem
              label="Profiles"
              value={`${diagnostics.profiles.length} managed profile${
                diagnostics.profiles.length === 1 ? "" : "s"
              }`}
              tone="neutral"
            />
            <ReadinessItem
              label="Smoke check"
              value={statusLabel(diagnostics.last_smoke_result.status)}
              tone="neutral"
            />
          </div>
        ) : null}
      </section>

      <section className="panel settings-panel" aria-label="Maintenance">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2>Maintenance</h2>
          </div>
        </div>

        <div className="settings-maintenance-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onInstallBinary();
            }}
          >
            Install CloakBrowser Binary
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onCleanupProfiles();
            }}
          >
            Cleanup Orphaned Profiles
          </Button>
        </div>
        <p className="muted">
          Maintenance commands only operate on the local lab runtime and orphaned
          inactive browser profiles.
        </p>
        {maintenanceMessage ? <p role="status">{maintenanceMessage}</p> : null}
      </section>

      <section className="panel settings-panel" aria-label="Graph shortcuts">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph shortcuts</h2>
          </div>
        </div>

        <GraphShortcutGuide />
      </section>

    </section>
  );
}

function ReadinessItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "attention" | "neutral";
}) {
  return (
    <div className={`settings-readiness-item settings-readiness-item-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
