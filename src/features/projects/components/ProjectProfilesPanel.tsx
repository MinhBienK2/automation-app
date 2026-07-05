import { useState, useMemo } from "react";
import { Plus, Trash2, Fingerprint, Pencil, Search } from "lucide-react";
import { ProfileEditDialog } from "./ProfileEditDialog";
import { Button } from "../../../components/ui/button";
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedEnv = browserProfiles.find((env) => env.id === selectedEnvId) ?? null;

  async function handleAddProfile() {
    if (!project || !newProfileName.trim()) return;
    setAdding(true);
    try {
      await onCreateBrowserProfile(project.id, { name: newProfileName.trim(), description: null });
      setNewProfileName("");
      setCreateDialogOpen(false);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteProfile() {
    if (!selectedEnvId) return;
    setDeleting(true);
    try {
      await onDeleteBrowserProfile(selectedEnvId);
      setDeleteDialogOpen(false);
      setSelectedEnvId(null);
    } finally {
      setDeleting(false);
    }
  }

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return browserProfiles;
    return browserProfiles.filter((p) => p.name.toLowerCase().includes(query));
  }, [browserProfiles, searchQuery]);

  return (
    <section className="app-screen workflow-list-screen" aria-label="Profiles workspace">
      <div role="group" aria-label="Browser Profiles" style={{ display: "contents" }}>
        {error ? <p className="field-error" role="alert">{error}</p> : null}

        {/* Toolbar Filter */}
        <div className="toolbar">
          <div className="search-input-wrapper">
            <Search aria-hidden="true" />
            <Input
              className="text-input"
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button shape="pill" type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus aria-hidden="true" />
              Add profile
            </Button>
          </div>
        </div>

        <section className="workflow-library data-table-card" aria-label="Browser profiles list">
          {filteredProfiles.length === 0 ? (
            <div className="empty-state panel profile-empty-state">
              <Fingerprint aria-hidden="true" className="profile-empty-icon" />
              <h2>No profiles configured</h2>
              <p className="muted">Add a profile to start setting up browser configurations.</p>
            </div>
          ) : (
            <table className="grid-table">
              <thead>
                <tr>
                  <th>PROFILE NAME</th>
                  <th>USAGE</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((env) => {
                  const count = workflows.filter((w) => w.browser_profile_id === env.id).length;
                  return (
                    <tr key={env.id} className="grid-row" data-slot="card">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Fingerprint aria-hidden="true" style={{ color: "var(--accent)", width: "16px", height: "16px" }} />
                          <h2
                            className="row-title"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setSelectedEnvId(env.id);
                              setEditDialogOpen(true);
                            }}
                          >
                            {env.name}
                          </h2>
                        </div>
                      </td>
                      <td style={{ color: "var(--fg-secondary)", fontWeight: 500 }}>
                        {count === 0 ? "Not used" : `Used by ${count} workflow${count === 1 ? "" : "s"}`}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "3px", justifyContent: "flex-end", alignItems: "center" }}>
                          <IconButton
                            label={`Configure profile ${env.name}`}
                            type="button"
                            className="btn-action-circle"
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
                            className="btn-action-circle btn-destruct"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              <Button type="button" variant="secondary" disabled={adding} onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={adding} loading={adding} onClick={handleAddProfile}>
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
              <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={deleting} loading={deleting} onClick={handleDeleteProfile}>
                Delete profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
