import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
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
  WorkflowSummary,
} from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  project: Project | null;
  projectEnvironments: ProjectEnvironment[];
  workflows: WorkflowSummary[];
  error: string;
  onUpdateProject: (
    projectId: string,
    input: { name?: string; description?: string | null },
  ) => Promise<void>;
  onDuplicateProject: (projectId: string) => Promise<void>;
  onExportProjectPackage: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onCreateProjectEnvironment: (
    projectId: string,
    input: ProjectEnvironmentInput,
  ) => Promise<void>;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ) => Promise<void>;
  onDeleteProjectEnvironment: (environmentId: string) => Promise<void>;
};

export function ProjectEnvironmentSettings({
  project,
  projectEnvironments,
  workflows,
  error,
  onUpdateProject,
  onDuplicateProject,
  onExportProjectPackage,
  onDeleteProject,
  onCreateProjectEnvironment,
  onUpdateProjectEnvironment,
  onDeleteProjectEnvironment,
}: ProjectEnvironmentSettingsProps) {
  const [projectNameDraft, setProjectNameDraft] = useState(project?.name ?? "");
  const [profileNameDrafts, setProfileNameDrafts] = useState<Record<string, string>>({});
  const [newProfileName, setNewProfileName] = useState("");
  const [localError, setLocalError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [duplicatingProject, setDuplicatingProject] = useState(false);
  const [exportingProject, setExportingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);
  const [deleteProfileCandidate, setDeleteProfileCandidate] =
    useState<ProjectEnvironment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const savedProjectName = project?.name ?? "";
  const projectNameChanged = projectNameDraft.trim() !== savedProjectName;

  useEffect(() => {
    setProjectNameDraft(savedProjectName);
    setLocalError("");
  }, [project?.id, savedProjectName]);

  useEffect(() => {
    setProfileNameDrafts(
      Object.fromEntries(
        projectEnvironments.map((environment) => [environment.id, environment.name]),
      ),
    );
    setLocalError("");
  }, [projectEnvironments]);

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

  async function createProfile() {
    if (!project) return;
    const name = newProfileName.trim();
    if (!name) {
      setLocalError("Profile name is required.");
      return;
    }
    setLocalError("");
    setCreatingProfile(true);
    try {
      await onCreateProjectEnvironment(project.id, { name, description: null });
      setNewProfileName("");
      setCreateProfileDialogOpen(false);
    } finally {
      setCreatingProfile(false);
    }
  }

  async function saveProfileName(environment: ProjectEnvironment) {
    const name = (profileNameDrafts[environment.id] ?? "").trim();
    if (!name) {
      setLocalError("Profile name is required.");
      return;
    }
    setLocalError("");
    setSavingProfileId(environment.id);
    try {
      await onUpdateProjectEnvironment(environment.id, { name });
    } finally {
      setSavingProfileId(null);
    }
  }

  async function confirmDeleteProfile() {
    if (!deleteProfileCandidate) return;
    setLocalError("");
    setDeletingProfileId(deleteProfileCandidate.id);
    try {
      await onDeleteProjectEnvironment(deleteProfileCandidate.id);
      setDeleteProfileCandidate(null);
    } finally {
      setDeletingProfileId(null);
    }
  }

  function profileUsageCount(environmentId: string) {
    return workflows.filter((workflow) => workflow.environment_id === environmentId).length;
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

      <SettingsFieldGroup
        title="Browser Profiles"
        description="Profiles own browser storage, fingerprint identity, and launch posture for workflows in this project."
      >
        <div className="project-profile-list settings-field-group-wide">
          {projectEnvironments.length === 0 ? (
            <p className="muted">No browser profiles in this project.</p>
          ) : (
            projectEnvironments.map((environment) => {
              const usageCount = profileUsageCount(environment.id);
              const draftName = profileNameDrafts[environment.id] ?? environment.name;
              const nameChanged = draftName.trim() !== environment.name;
              const pending = savingProfileId === environment.id || deletingProfileId === environment.id;
              return (
                <div className="project-profile-row" key={environment.id}>
                  <label className="field project-profile-name-field">
                    <span>Profile name</span>
                    <Input
                      aria-label={`Profile name for ${environment.name}`}
                      value={draftName}
                      disabled={pending}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setProfileNameDrafts((current) => ({
                          ...current,
                          [environment.id]: nextValue,
                        }));
                      }}
                    />
                  </label>
                  <div className="project-profile-meta">
                    <span>{usageCount === 0 ? "Not used" : `Used by ${usageCount} workflow${usageCount === 1 ? "" : "s"}`}</span>
                  </div>
                  <div className="project-session-actions project-profile-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Save profile name for ${environment.name}`}
                      disabled={!nameChanged || pending}
                      onClick={() => {
                        void saveProfileName(environment);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      aria-label={`Delete profile ${environment.name}`}
                      disabled={usageCount > 0 || pending}
                      title={usageCount > 0 ? "Profile is used by workflows" : undefined}
                      onClick={() => setDeleteProfileCandidate(environment)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="project-session-actions settings-field-group-wide">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setCreateProfileDialogOpen(true)}
            disabled={!project || creatingProfile}
          >
            <Plus aria-hidden="true" />
            Add profile
          </Button>
        </div>
      </SettingsFieldGroup>

      <Dialog open={createProfileDialogOpen} onOpenChange={setCreateProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add browser profile</DialogTitle>
            <DialogDescription>
              Create a fresh browser profile for this project.
            </DialogDescription>
          </DialogHeader>
          <label className="field">
            <span>Profile name</span>
            <Input
              aria-label="Profile name"
              autoFocus
              value={newProfileName}
              disabled={creatingProfile}
              onChange={(event) => setNewProfileName(event.currentTarget.value)}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={creatingProfile}
              onClick={() => setCreateProfileDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={creatingProfile}
              onClick={() => {
                void createProfile();
              }}
            >
              Create profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteProfileCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteProfileCandidate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete browser profile</DialogTitle>
            <DialogDescription>
              Do you want to delete this browser profile?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(deletingProfileId)}
              onClick={() => setDeleteProfileCandidate(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(deletingProfileId)}
              onClick={() => {
                void confirmDeleteProfile();
              }}
            >
              Delete profile
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
