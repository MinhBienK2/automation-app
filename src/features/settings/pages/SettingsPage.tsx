import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { SwitchField } from "../../../components/ui/switch";
import type { AppConfig } from "../../../types/electron";

type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  maintenanceMessage: string;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
  onInstallBinary: () => void | Promise<void>;
  onCleanupProfiles: () => void | Promise<void>;
  appConfig: AppConfig;
  onSaveAppConfig: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
};

export function SettingsPage({
  graphAutosaveEnabled,
  maintenanceMessage,
  onGraphAutosaveEnabledChange,
  onInstallBinary,
  onCleanupProfiles,
  appConfig,
  onSaveAppConfig,
}: SettingsPageProps) {
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);

  const [dbMode, setDbMode] = useState<"private" | "publish">(appConfig.dbMode);
  const [postgresUrl, setPostgresUrl] = useState(appConfig.postgresUrl);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setDbMode(appConfig.dbMode);
    setPostgresUrl(appConfig.postgresUrl);
  }, [appConfig]);

  async function handleSaveConfig() {
    setSavePending(true);
    setSaveError("");
    try {
      const res = await onSaveAppConfig({ dbMode, postgresUrl });
      if (!res.success && res.error) {
        setSaveError(res.error);
      }
    } catch (err: any) {
      setSaveError(err.message || "Failed to save configuration.");
    } finally {
      setSavePending(false);
    }
  }


  async function confirmCleanupProfiles() {
    setCleanupPending(true);
    try {
      await onCleanupProfiles();
      setCleanupDialogOpen(false);
    } finally {
      setCleanupPending(false);
    }
  }

  return (
    <section className="app-screen settings-screen" aria-label="Settings">
      <header className="app-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Setting</h1>
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

      <section className="panel settings-panel" aria-label="Database settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Database</p>
            <h2>Database storage mode</h2>
          </div>
        </div>

        <div className="settings-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
          <div>
            <label className="text-sm font-medium text-[var(--app-text)]" htmlFor="db-mode-select">
              Storage Mode
            </label>
            <div style={{ marginTop: '8px' }}>
              <Select
                id="db-mode-select"
                value={dbMode}
                onChange={(e) => setDbMode(e.target.value as "private" | "publish")}
              >
                <option value="private">Private (Local SQLite)</option>
                <option value="publish">Publish (PostgreSQL Remote)</option>
              </Select>
            </div>
          </div>

          {dbMode === "publish" && (
            <div>
              <label className="text-sm font-medium text-[var(--app-text)]" htmlFor="postgres-url-input">
                PostgreSQL Connection URL
              </label>
              <div style={{ marginTop: '8px' }}>
                <Input
                  id="postgres-url-input"
                  type="text"
                  placeholder="postgresql://username:password@host:port/database"
                  value={postgresUrl}
                  onChange={(e) => setPostgresUrl(e.target.value)}
                />
              </div>
              <p className="muted text-xs" style={{ marginTop: '4px', opacity: 0.7 }}>
                Enter a valid PostgreSQL connection URL.
              </p>
            </div>
          )}

          {saveError && (
            <p className="text-sm text-destructive" style={{ color: 'red' }}>
              {saveError}
            </p>
          )}

          <div style={{ marginTop: '8px' }}>
            <Button
              type="button"
              disabled={savePending}
              onClick={handleSaveConfig}
            >
              {savePending ? "Saving..." : "Save Database Settings"}
            </Button>
          </div>
        </div>
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
              setCleanupDialogOpen(true);
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

      <Dialog
        open={cleanupDialogOpen}
        onOpenChange={(open) => {
          if (!cleanupPending) setCleanupDialogOpen(open);
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Maintenance</p>
            <DialogTitle>Cleanup orphaned profiles</DialogTitle>
            <DialogDescription>
              This deletes local inactive browser profile directories that are no
              longer referenced by a workflow or project browser profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={cleanupPending}
              onClick={() => setCleanupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cleanupPending}
              onClick={() => {
                void confirmCleanupProfiles();
              }}
            >
              Cleanup Profiles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}

