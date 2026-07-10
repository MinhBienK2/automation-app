import { useState, useMemo } from "react";
import { Plus, Trash2, Fingerprint, Pencil, Search } from "lucide-react";
import { ProfileEditDialog } from "./ProfileEditDialog";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { Alert } from "../../../components/ui/alert";
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
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
    <section className="flex flex-col gap-4" aria-label="Profiles workspace">
      <div role="group" aria-label="Browser Profiles" className="contents">
        {error ? (
          <Alert variant="error" className="text-xs p-3">
            {error}
          </Alert>
        ) : null}

        {/* Toolbar Filter */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-2">
          <div className="relative max-w-xs flex-grow">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <Input
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              className="pl-9 input-sm border-base-300"
            />
          </div>
          <Button type="button" onClick={() => setCreateDialogOpen(true)} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <Plus aria-hidden="true" size={16} />
            <span>Add profile</span>
          </Button>
        </div>

        <section className="card bg-base-200 border border-base-300 card-body p-5 flex flex-col" aria-label="Browser profiles list">
          {filteredProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg bg-base-100/50 border border-dashed border-base-300 text-secondary">
              <Fingerprint aria-hidden="true" className="w-10 h-10 mb-2 text-secondary stroke-[1.5]" />
              <h2 className="text-sm font-bold text-base-content mb-1">No profiles configured</h2>
              <p className="text-xs max-w-[280px]">Add a profile to start setting up browser configurations.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PROFILE NAME</TableHead>
                  <TableHead>USAGE</TableHead>
                  <TableHead className="text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((env) => {
                  const count = workflows.filter((w) => w.browser_profile_id === env.id).length;
                  return (
                    <TableRow key={env.id} data-slot="card">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                            <Fingerprint aria-hidden="true" className="w-3.5 h-3.5" />
                          </div>
                          <h2
                            className="font-bold text-sm text-base-content cursor-pointer hover:underline hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedEnvId(env.id);
                              setEditDialogOpen(true);
                            }}
                          >
                            {env.name}
                          </h2>
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary text-xs font-medium">
                        {count === 0 ? "Not used" : `Used by ${count} workflow${count === 1 ? "" : "s"}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end items-center">
                          <IconButton
                            label={`Configure profile ${env.name}`}
                            type="button"
                            variant="ghost"
                            className="text-fg-primary hover:text-accent w-8 h-8"
                            onClick={() => {
                              setSelectedEnvId(env.id);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil aria-hidden="true" size={15} />
                          </IconButton>
                          <IconButton
                            label={`Delete profile ${env.name}`}
                            type="button"
                            variant="ghost"
                            className={`hover:bg-error/10 w-8 h-8 ${count > 0 ? "text-base-content/30" : "text-error"}`}
                            disabled={count > 0}
                            tooltip={count > 0 ? "Profile is used by workflows" : `Delete profile ${env.name}`}
                            onClick={() => {
                              setSelectedEnvId(env.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
            <div className="flex flex-col gap-1.5 mt-2">
              <Label htmlFor="create-profile-name">Profile name</Label>
              <Input
                id="create-profile-name"
                aria-label="Profile name"
                autoFocus
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="input-sm border-base-300"
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button type="button" variant="secondary" disabled={adding} onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={adding} loading={adding} onClick={handleAddProfile} className="btn-primary">
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
            <DialogFooter className="flex gap-2">
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
