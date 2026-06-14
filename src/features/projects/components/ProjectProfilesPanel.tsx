import { useState } from "react";
import { Plus, Trash2, Fingerprint, Pencil } from "lucide-react";
import { ProfileEditDialog } from "./ProfileEditDialog";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { IconButton } from "../../../components/ui/icon-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import type {
  Project,
  BrowserProfile,
  WorkflowSummary,
  BrowserProfileInput,
} from "../../../types/workflow";

type ProjectProfilesPanelProps = {
  project: Project | null;
  browserProfiles: BrowserProfile[];
  workflows: WorkflowSummary[];
  overview: any; // Keep signature compatibility
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelectIdentity: (workflowId: string, identityId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onCloseRetainedSession: (workflowId: string, profileName: string) => void;
  onResetIdentity: (workflowId: string) => void | Promise<void>;
  onOpenIdentityTarget: (target: any) => void;
  onCreateBrowserProfile: (
    projectId: string,
    input: { name: string; description?: string | null },
  ) => Promise<void>;
  onUpdateBrowserProfile: (
    profileId: string,
    input: Partial<BrowserProfileInput>,
  ) => Promise<void>;
  onDeleteBrowserProfile: (profileId: string) => Promise<void>;
};

export function ProjectProfilesPanel(props: ProjectProfilesPanelProps) {
  const {
    project,
    browserProfiles,
    workflows,
    error,
    onCreateBrowserProfile,
    onUpdateBrowserProfile,
    onDeleteBrowserProfile,
    onOpenWorkflow,
  } = props;

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const selectedEnv = browserProfiles.find((e) => e.id === selectedEnvId) || null;

  async function handleAddProfile() {
    if (!project || !newProfileName.trim()) return;
    await onCreateBrowserProfile(project.id, { name: newProfileName.trim(), description: null });
    setNewProfileName("");
    setCreateDialogOpen(false);
  }

  async function handleDeleteProfile() {
    if (!selectedEnvId) return;
    await onDeleteBrowserProfile(selectedEnvId);
    setDeleteDialogOpen(false);
    setSelectedEnvId(null);
  }

  return (
    <section className="app-screen workflow-list-screen" aria-label="Profiles workspace">
      <div role="group" aria-label="Browser Profiles" style={{ display: "contents" }}>
      <header className="app-header">
        <div>
          <h1>Browser Profiles</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Profile summary">
            <span>{browserProfiles.length} profiles</span>
          </div>
          <Button shape="pill" type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus aria-hidden="true" />
            Add profile
          </Button>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </header>

      <section className="workflow-library" aria-label="Browser profiles list">
        {browserProfiles.length === 0 ? (
          <div className="empty-state panel" style={{ minHeight: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Fingerprint aria-hidden="true" style={{ width: "36px", height: "36px", color: "var(--app-muted)", marginBottom: "12px" }} />
            <h2>No profiles configured</h2>
            <p className="muted">Add a profile to start setting up browser configurations.</p>
          </div>
        ) : (
          browserProfiles.map((env) => {
            const count = workflows.filter((w) => w.browser_profile_id === env.id).length;
            return (
              <Card className="workflow-card" key={env.id}>
                <div className="workflow-card-main">
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "6px",
                      background: "rgba(50, 211, 230, 0.06)",
                      border: "1px solid rgba(50, 211, 230, 0.15)"
                    }}>
                      <Fingerprint style={{ width: "20px", height: "20px", color: "var(--app-accent)" }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--app-text)" }}>{env.name}</h2>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                        {count === 0 ? "Not used" : `Used by ${count} workflow${count === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <IconButton
                    label={`Configure profile ${env.name}`}
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedEnvId(env.id);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete profile ${env.name}`}
                    type="button"
                    variant="destructive"
                    disabled={count > 0}
                    tooltip={count > 0 ? "Profile is used by workflows" : `Delete profile ${env.name}`}
                    onClick={() => {
                      setSelectedEnvId(env.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <ProfileEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedEnv={selectedEnv}
        workflows={workflows}
        onUpdateBrowserProfile={onUpdateBrowserProfile}
        onOpenWorkflow={onOpenWorkflow}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add browser profile</DialogTitle>
            <DialogDescription>Create a fresh browser profile for this project.</DialogDescription>
          </DialogHeader>
          <label className="field">
            <span>Profile name</span>
            <Input
              aria-label="Profile name"
              autoFocus
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddProfile}>
              Create profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete browser profile</DialogTitle>
            <DialogDescription>Do you want to delete this browser profile?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteProfile}>
              Delete profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </section>
  );
}
