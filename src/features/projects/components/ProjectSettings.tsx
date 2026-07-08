import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
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
    <section className="flex flex-col gap-6" aria-label="Project Settings">
      <h2 className="sr-only">Project Settings</h2>
      {error ? (
        <div className="alert alert-error text-xs p-3" role="alert">
          {error}
        </div>
      ) : null}
      {localError ? (
        <div className="alert alert-error text-xs p-3" role="alert">
          {localError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Details section */}
        <section className="card bg-base-200 border border-base-300 card-body p-6 flex flex-col justify-between" aria-label="Project details card">
          <div>
            <div className="border-b border-base-300 pb-3 mb-4">
              <h3 className="text-sm font-bold text-base-content uppercase tracking-wider">Project Details</h3>
              <p className="text-secondary text-xs mt-0.5">Manage project details and backups</p>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2 project-name-control">
              <Label htmlFor="project-settings-name">Project name</Label>
              <div className="flex gap-2">
                <Input
                  id="project-settings-name"
                  aria-label="Project name"
                  value={projectNameDraft}
                  disabled={!project || projectActionPending}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  className="input-sm border-base-300 flex-grow"
                />
                <Button
                  type="button"
                  onClick={() => {
                    void saveProjectName();
                  }}
                  disabled={!project || !projectNameChanged || projectActionPending}
                  loading={savingProject}
                  className="btn-primary btn-sm"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void duplicateProject();
              }}
              disabled={!project || projectActionPending}
              loading={duplicatingProject}
              className="btn-sm"
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
              loading={exportingProject}
              className="btn-sm flex items-center gap-1.5"
            >
              <Download aria-hidden="true" size={14} />
              <span>Export project</span>
            </Button>
          </div>
        </section>

        {/* Danger Zone section */}
        <section className="card bg-base-200 border border-error/25 card-body p-6 flex flex-col justify-between" aria-label="Danger zone card">
          <div>
            <div className="border-b border-error/20 pb-3 mb-4">
              <h3 className="text-sm font-bold text-error uppercase tracking-wider">Danger Zone</h3>
              <p className="text-secondary text-xs mt-0.5">Irreversible actions for this project</p>
            </div>
            <p className="text-secondary text-xs leading-relaxed mt-2">
              Once you delete a project, there is no going back. All workflows, subflows, and browser profiles will be permanently lost.
            </p>
          </div>

          <div className="mt-6 flex justify-start">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={!project || projectActionPending}
              className="btn-sm flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Delete project</span>
            </Button>
          </div>
        </section>
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
          <DialogFooter className="flex gap-2">
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
              loading={deletingProject}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
