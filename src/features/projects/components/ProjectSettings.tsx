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
import type { Project } from "../../../types/workflow";

type ProjectSettingsProps = {
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

export function ProjectSettings({
  project,
  error,
  onUpdateProject,
  onDuplicateProject,
  onExportProjectPackage,
  onDeleteProject,
}: ProjectSettingsProps) {
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
      aria-label="Project Settings"
    >
      <h2 className="sr-only">Project Settings</h2>
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

      <div className="settings-grid">
        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Project Details</h3>
            <p>Manage project details and backups</p>
          </div>
          <div className="settings-section-body">
            <div className="project-name-control">
              <label className="form-label" htmlFor="project-settings-name">Project name</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Input
                  id="project-settings-name"
                  className="text-input-full"
                  aria-label="Project name"
                  value={projectNameDraft}
                  disabled={!project || projectActionPending}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => {
                    void saveProjectName();
                  }}
                  disabled={!project || !projectNameChanged || projectActionPending}
                >
                  Save
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <Button
                type="button"
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
                variant="secondary"
                onClick={() => {
                  void exportProjectPackage();
                }}
                disabled={!project || projectActionPending}
              >
                <Download aria-hidden="true" style={{ width: "16px", height: "16px" }} />
                Export project
              </Button>
            </div>
          </div>
        </div>

        <div className="settings-section" style={{ borderColor: "var(--destructive-border)" }}>
          <div className="settings-section-header">
            <h3 style={{ color: "var(--destructive)" }}>Danger Zone</h3>
            <p>Irreversible actions for this project</p>
          </div>
          <div className="settings-section-body">
            <p style={{ color: "var(--fg-secondary)", fontSize: "13px", marginBottom: "16px" }}>
              Once you delete a project, there is no going back. All workflows, subflows, and browser profiles will be permanently lost.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={!project || projectActionPending}
            >
              Delete project
            </Button>
          </div>
        </div>
      </div>

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
