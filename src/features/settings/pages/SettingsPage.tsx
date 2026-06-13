import { useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { SwitchField } from "../../../components/ui/switch";

type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  maintenanceMessage: string;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
  onInstallBinary: () => void | Promise<void>;
  onCleanupProfiles: () => void | Promise<void>;
};

export function SettingsPage({
  graphAutosaveEnabled,
  maintenanceMessage,
  onGraphAutosaveEnabledChange,
  onInstallBinary,
  onCleanupProfiles,
}: SettingsPageProps) {
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);

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

