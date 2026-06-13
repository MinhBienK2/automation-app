import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
import type { Project } from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  project: Project | null;
  error: string;
  onUpdateProject: (
    projectId: string,
    input: { name?: string; description?: string | null },
  ) => Promise<void>;
  onDuplicateProject: (projectId: string) => Promise<void>;
  onExportProjectPackage: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
};

export function ProjectEnvironmentSettings({
  project,
  error,
  onUpdateProject,
  onDuplicateProject,
  onExportProjectPackage,
  onDeleteProject,
}: ProjectEnvironmentSettingsProps) {
  const [projectNameDraft, setProjectNameDraft] = useState(project?.name ?? "");
  const [localError, setLocalError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [duplicatingProject, setDuplicatingProject] = useState(false);
  const [exportingProject, setExportingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const savedProjectName = project?.name ?? "";
  const projectNameChanged = projectNameDraft.trim() !== savedProjectName;

  useEffect(() => {
    setProjectNameDraft(savedProjectName);
    setLocalError("");
  }, [project?.id, savedProjectName]);

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

  async function exportProjectPackage() {
    if (!project) return;
    setLocalError("");
    setExportingProject(true);
    try {
      await onExportProjectPackage(project.id);
    } finally {
      setExportingProject(false);
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

  const projectActionPending =
    savingProject || duplicatingProject || exportingProject || deletingProject;

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
        <div className="project-name-control">
          <label className="field project-session-seed-field">
            <span>Project name</span>
            <Input
              aria-label="Project name"
              value={projectNameDraft}
              disabled={!project || projectActionPending}
              onChange={(event) => setProjectNameDraft(event.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void saveProjectName();
            }}
            disabled={!project || !projectNameChanged || projectActionPending}
          >
            Save
          </Button>
        </div>

        <div className="project-session-actions">
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
            variant="secondary"
            onClick={() => {
              void exportProjectPackage();
            }}
            disabled={!project || projectActionPending}
          >
            <Download aria-hidden="true" />
            Export project
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
