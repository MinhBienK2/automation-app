import { useEffect, useState } from "react";
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
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import type {
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
} from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  project: Project | null;
  projectEnvironments: ProjectEnvironment[];
  error: string;
  onUpdateProject: (
    projectId: string,
    input: { name?: string; description?: string | null },
  ) => Promise<void>;
  onDuplicateProject: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ) => Promise<void>;
  onResetProjectEnvironmentBrowserIdentity: (
    environmentId: string,
  ) => Promise<void>;
};

export function ProjectEnvironmentSettings({
  project,
  projectEnvironments,
  error,
  onUpdateProject,
  onDuplicateProject,
  onDeleteProject,
  onUpdateProjectEnvironment,
  onResetProjectEnvironmentBrowserIdentity,
}: ProjectEnvironmentSettingsProps) {
  const projectSession =
    projectEnvironments.find((environment) => environment.is_default) ??
    projectEnvironments[0] ??
    null;
  const browserLaunch = projectSession?.browser_launch ?? null;
  const [projectNameDraft, setProjectNameDraft] = useState(project?.name ?? "");
  const [seedDraft, setSeedDraft] = useState(browserLaunch?.fingerprint_seed ?? "");
  const [localError, setLocalError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [duplicatingProject, setDuplicatingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [savingSeed, setSavingSeed] = useState(false);
  const [regeneratingIdentity, setRegeneratingIdentity] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const savedProjectName = project?.name ?? "";
  const savedSeed = browserLaunch?.fingerprint_seed ?? "";
  const projectNameChanged = projectNameDraft.trim() !== savedProjectName;
  const seedChanged = seedDraft.trim() !== savedSeed;

  useEffect(() => {
    setProjectNameDraft(savedProjectName);
    setLocalError("");
  }, [project?.id, savedProjectName]);

  useEffect(() => {
    setSeedDraft(savedSeed);
    setLocalError("");
  }, [projectSession?.id, savedSeed]);

  async function saveProjectName() {
    if (!project) return;
    const nextName = projectNameDraft.trim();
    if (!nextName) {
      setLocalError("Project name is required.");
      return;
    }
    setLocalError("");
    setSavingProject(true);
    try {
      await onUpdateProject(project.id, {
        name: nextName,
        description: project.description,
      });
    } finally {
      setSavingProject(false);
    }
  }

  async function duplicateProject() {
    if (!project) return;
    setLocalError("");
    setDuplicatingProject(true);
    try {
      await onDuplicateProject(project.id);
    } finally {
      setDuplicatingProject(false);
    }
  }

  async function confirmDeleteProject() {
    if (!project) return;
    setLocalError("");
    setDeletingProject(true);
    try {
      await onDeleteProject(project.id);
      setDeleteDialogOpen(false);
    } finally {
      setDeletingProject(false);
    }
  }

  async function saveFingerprintSeed() {
    if (!projectSession || !browserLaunch) return;
    const nextSeed = seedDraft.trim();
    if (!nextSeed) {
      setLocalError("Fingerprint seed is required.");
      return;
    }
    setLocalError("");
    setSavingSeed(true);
    try {
      await onUpdateProjectEnvironment(projectSession.id, {
        name: projectSession.name,
        description: projectSession.description,
        is_default: projectSession.is_default,
        browser_launch: {
          ...browserLaunch,
          fingerprint_seed: nextSeed,
        },
      });
    } finally {
      setSavingSeed(false);
    }
  }

  async function regenerateIdentity() {
    if (!projectSession) return;
    setLocalError("");
    setRegeneratingIdentity(true);
    try {
      await onResetProjectEnvironmentBrowserIdentity(projectSession.id);
    } finally {
      setRegeneratingIdentity(false);
    }
  }

  async function confirmRegenerateIdentity() {
    await regenerateIdentity();
    setRegenerateDialogOpen(false);
  }

  const projectActionPending = savingProject || duplicatingProject || deletingProject;

  return (
    <section
      className="panel settings-panel settings-project-environments-panel"
      aria-label="Project identity"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Settings</p>
          <h2>Project identity</h2>
        </div>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {localError ? (
        <p className="field-error" role="alert">
          {localError}
        </p>
      ) : null}

      <SettingsFieldGroup title="Project details">
        <label className="field project-session-seed-field">
          <span>Project name</span>
          <Input
            aria-label="Project name"
            value={projectNameDraft}
            disabled={!project || projectActionPending}
            onChange={(event) => setProjectNameDraft(event.target.value)}
          />
        </label>

        <div className="project-session-actions">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void saveProjectName();
            }}
            disabled={!project || !projectNameChanged || projectActionPending}
          >
            Save project name
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void duplicateProject();
            }}
            disabled={!project || projectActionPending}
          >
            Duplicate project
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!project || projectActionPending}
          >
            Delete project
          </Button>
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup title="Browser fingerprint">
        <label className="field project-session-seed-field">
          <span>Fingerprint seed</span>
          <Input
            aria-label="Fingerprint seed"
            className="project-session-code"
            value={seedDraft}
            disabled={!browserLaunch || savingSeed || regeneratingIdentity}
            onChange={(event) => setSeedDraft(event.target.value)}
          />
        </label>

        <div className="field project-session-value-row">
          <span>Identity</span>
          <strong className="project-session-code">
            {browserLaunch?.identity_id ?? "unavailable"}
          </strong>
        </div>

        <div className="project-session-actions">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void saveFingerprintSeed();
            }}
            disabled={!browserLaunch || !seedChanged || savingSeed || regeneratingIdentity}
          >
            Save fingerprint seed
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setRegenerateDialogOpen(true);
            }}
            disabled={!projectSession || savingSeed || regeneratingIdentity}
          >
            Regenerate identity
          </Button>
        </div>
      </SettingsFieldGroup>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate project identity?</DialogTitle>
            <DialogDescription>
              This will create a new fingerprint seed and identity, then delete the
              current local browser profile for this project session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRegenerateDialogOpen(false)}
              disabled={regeneratingIdentity}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void confirmRegenerateIdentity();
              }}
              disabled={!projectSession || regeneratingIdentity}
            >
              Regenerate and delete profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will delete the project and every workflow, subflow, and saved
              browser session inside it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingProject}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void confirmDeleteProject();
              }}
              disabled={!project || deletingProject}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
