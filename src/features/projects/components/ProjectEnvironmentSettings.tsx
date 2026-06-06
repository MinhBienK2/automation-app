import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import { SwitchField } from "../../../components/ui/switch";
import { BrowserLaunchSettingsSection } from "../../workflows/components/WorkflowSettingsDialog";
import type { ProjectEnvironment } from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  projectEnvironments: ProjectEnvironment[];
  error: string;
  onCreateProjectEnvironment: (input: { name: string; description?: string | null }) => Promise<void>;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: {
      name?: string;
      description?: string | null;
      is_default?: boolean | null;
      browser_launch?: ProjectEnvironment["browser_launch"] | null;
    },
  ) => Promise<void>;
};

type EnvironmentEditDraft = {
  name: string;
  description: string;
  is_default: boolean;
  browser_launch: ProjectEnvironment["browser_launch"] | null;
};

export function ProjectEnvironmentSettings({
  projectEnvironments,
  error,
  onCreateProjectEnvironment,
  onUpdateProjectEnvironment,
}: ProjectEnvironmentSettingsProps) {
  const [environmentDialogOpen, setEnvironmentDialogOpen] = useState(false);
  const [environmentNameDraft, setEnvironmentNameDraft] = useState("");
  const [environmentDescriptionDraft, setEnvironmentDescriptionDraft] = useState("");
  const [environmentError, setEnvironmentError] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [selectedEnvironmentDraft, setSelectedEnvironmentDraft] =
    useState<EnvironmentEditDraft | null>(null);
  const selectedEnvironment =
    projectEnvironments.find((environment) => environment.id === selectedEnvironmentId) ??
    projectEnvironments[0] ??
    null;

  useEffect(() => {
    if (projectEnvironments.length === 0) {
      setSelectedEnvironmentId(null);
      setSelectedEnvironmentDraft(null);
      return;
    }
    if (!selectedEnvironmentId || !projectEnvironments.some((item) => item.id === selectedEnvironmentId)) {
      setSelectedEnvironmentId(projectEnvironments[0].id);
    }
  }, [projectEnvironments, selectedEnvironmentId]);

  useEffect(() => {
    if (!selectedEnvironment) {
      setSelectedEnvironmentDraft(null);
      return;
    }
    setSelectedEnvironmentDraft({
      name: selectedEnvironment.name,
      description: selectedEnvironment.description,
      is_default: selectedEnvironment.is_default,
      browser_launch: selectedEnvironment.browser_launch ?? null,
    });
  }, [selectedEnvironment?.id, selectedEnvironment?.updated_at]);

  async function submitEnvironment(event: FormEvent) {
    event.preventDefault();
    const name = environmentNameDraft.trim();
    if (!name) {
      setEnvironmentError("Environment name is required");
      return;
    }
    await onCreateProjectEnvironment({
      name,
      description: environmentDescriptionDraft.trim() || null,
    });
    setEnvironmentDialogOpen(false);
    setEnvironmentNameDraft("");
    setEnvironmentDescriptionDraft("");
    setEnvironmentError("");
  }

  function closeEnvironmentDialog() {
    setEnvironmentDialogOpen(false);
    setEnvironmentNameDraft("");
    setEnvironmentDescriptionDraft("");
    setEnvironmentError("");
  }

  async function saveSelectedEnvironment() {
    if (!selectedEnvironment || !selectedEnvironmentDraft) return;
    const name = selectedEnvironmentDraft.name.trim();
    if (!name) {
      setEnvironmentError("Environment name is required");
      return;
    }
    setEnvironmentError("");
    await onUpdateProjectEnvironment(selectedEnvironment.id, {
      name,
      description: selectedEnvironmentDraft.description.trim() || null,
      is_default: selectedEnvironmentDraft.is_default,
      browser_launch: selectedEnvironmentDraft.browser_launch,
    });
  }

  return (
    <section
      className="panel settings-panel settings-project-environments-panel"
      aria-label="Project environments"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Settings</p>
          <h2>Project environments</h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEnvironmentDialogOpen(true)}
        >
          Create Environment
        </Button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {projectEnvironments.length === 0 ? (
        <p className="muted">No project environments are available.</p>
      ) : (
        <div className="settings-environment-workspace">
          <div className="settings-environment-list">
            {projectEnvironments.map((environment) => (
              <div
                className="settings-environment-row"
                data-active={selectedEnvironment?.id === environment.id ? "true" : "false"}
                key={environment.id}
              >
                <div>
                  <h3>{environment.name}</h3>
                  {environment.description ? (
                    <p className="muted">{environment.description}</p>
                  ) : null}
                </div>
                <div className="settings-environment-row-actions">
                  {environment.is_default ? (
                    <span className="settings-environment-badge">Default</span>
                  ) : null}
                  <Button
                    aria-label={`Open ${environment.name} environment`}
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedEnvironmentId(environment.id)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {selectedEnvironment && selectedEnvironmentDraft ? (
            <section
              className="settings-environment-detail"
              aria-label="Selected Project Environment"
            >
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Selected Environment</p>
                  <h3>{selectedEnvironment.name}</h3>
                </div>
                <Button type="button" onClick={() => void saveSelectedEnvironment()}>
                  Save Environment
                </Button>
              </div>
              {environmentError ? (
                <p className="field-error" role="alert">
                  {environmentError}
                </p>
              ) : null}
              <SettingsFieldGroup
                title="General"
                description="Project-scoped metadata and default selection for workflow creation."
              >
                <label className="field">
                  <span>Environment name</span>
                  <Input
                    value={selectedEnvironmentDraft.name}
                    onChange={(event) =>
                      setSelectedEnvironmentDraft({
                        ...selectedEnvironmentDraft,
                        name: event.currentTarget.value,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <Input
                    value={selectedEnvironmentDraft.description}
                    onChange={(event) =>
                      setSelectedEnvironmentDraft({
                        ...selectedEnvironmentDraft,
                        description: event.currentTarget.value,
                      })
                    }
                  />
                </label>
                <SwitchField
                  checked={selectedEnvironmentDraft.is_default}
                  label="Project default environment"
                  description="Use this environment when workflows choose the project default."
                  onCheckedChange={(checked) =>
                    setSelectedEnvironmentDraft({
                      ...selectedEnvironmentDraft,
                      is_default: checked,
                    })
                  }
                />
              </SettingsFieldGroup>
              {selectedEnvironmentDraft.browser_launch ? (
                <BrowserLaunchSettingsSection
                  value={selectedEnvironmentDraft.browser_launch}
                  onChange={(browserLaunch) =>
                    setSelectedEnvironmentDraft({
                      ...selectedEnvironmentDraft,
                      browser_launch: browserLaunch,
                    })
                  }
                />
              ) : (
                <p className="muted">
                  Browser launch settings are unavailable for this environment.
                </p>
              )}
            </section>
          ) : null}
        </div>
      )}

      <Dialog
        open={environmentDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeEnvironmentDialog();
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Project Environment</p>
            <DialogTitle>Create Environment</DialogTitle>
            <DialogDescription>
              Create a reusable browser launch environment for this project.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={submitEnvironment}>
            <Label htmlFor="environment-name">Environment name</Label>
            <Input
              autoFocus
              id="environment-name"
              value={environmentNameDraft}
              onChange={(event) => setEnvironmentNameDraft(event.currentTarget.value)}
              placeholder="Staging Chrome"
            />
            <Label htmlFor="environment-description">Description</Label>
            <Input
              id="environment-description"
              value={environmentDescriptionDraft}
              onChange={(event) =>
                setEnvironmentDescriptionDraft(event.currentTarget.value)
              }
              placeholder="Shared staging posture"
            />
            {environmentError ? <p className="field-error">{environmentError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit">
                Create
              </Button>
              <Button variant="secondary" type="button" onClick={closeEnvironmentDialog}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
