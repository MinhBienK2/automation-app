import { Copy, Eye, Plus, RefreshCw, Settings, Trash2, Download, Upload, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { IconButton } from "../../../components/ui/icon-button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { SubflowSummary } from "../../../types/workflow";
import { SubflowSettingsDialog } from "../components/SubflowSettingsDialog";

type SubflowListPageProps = {
  subflows: SubflowSummary[];
  loading: boolean;
  error: string;
  onCreateSubflow: (input: { name: string; description?: string | null }) => Promise<void>;
  onUpdateSubflow: (
    subflow: SubflowSummary,
    input: { name: string },
  ) => Promise<void>;
  onDuplicateSubflow: (subflow: SubflowSummary) => Promise<void>;
  onDeleteSubflow: (subflow: SubflowSummary) => Promise<void>;
  onOpenSubflow: (subflowId: string) => void;
  onRefresh: () => void;
  onExportSubflow: (subflowId: string) => void;
  onImportSubflowFile: (file: File | null) => void;
};

export function SubflowListPage({
  subflows,
  loading,
  error,
  onCreateSubflow,
  onUpdateSubflow,
  onDuplicateSubflow,
  onDeleteSubflow,
  onOpenSubflow,
  onRefresh,
  onExportSubflow,
  onImportSubflowFile,
}: SubflowListPageProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [settingsSubflow, setSettingsSubflow] = useState<SubflowSummary | null>(null);
  const [deleteSubflowCandidate, setDeleteSubflowCandidate] = useState<SubflowSummary | null>(null);
  const [localError, setLocalError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function submitCreateSubflow(event: React.FormEvent) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      setLocalError("Subflow name is required");
      return;
    }
    setCreating(true);
    try {
      await onCreateSubflow({
        name,
        description: descriptionDraft.trim() || null,
      });
      setCreateDialogOpen(false);
      setNameDraft("");
      setDescriptionDraft("");
      setLocalError("");
    } catch (err: any) {
      setLocalError(err.message || "Failed to create subflow");
    } finally {
      setCreating(false);
    }
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setNameDraft("");
    setDescriptionDraft("");
    setLocalError("");
  }

  const filteredSubflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return subflows;
    return subflows.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        (sub.description && sub.description.toLowerCase().includes(query)),
    );
  }, [subflows, searchQuery]);

  return (
    <div className="tab-content-area">
      <h1 className="sr-only">Subflows</h1>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Toolbar Filter */}
      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search aria-hidden="true" />
          <Input
            className="text-input"
            placeholder="Search subflows..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button
            variant="secondary"
            shape="pill"
            type="button"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <label className="workflow-import-button">
            <Upload aria-hidden="true" />
            Import Subflow
            <input
              aria-label="Subflow package file"
              className="workflow-package-file-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onImportSubflowFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button
            shape="pill"
            type="button"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus aria-hidden="true" />
            Create Subflow
          </Button>
        </div>
      </div>

      <section className="workflow-library data-table-card" aria-label="Subflow list">
        {filteredSubflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No subflows yet</h2>
            <p className="muted">Create one to reuse graph paths across workflows.</p>
          </div>
        ) : (
          <table className="grid-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>DESCRIPTION</th>
                <th>USED BY</th>
                <th style={{ textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubflows.map((subflow) => (
                <tr key={subflow.id} className="grid-row" data-slot="card">
                  <td>
                    <h2 className="row-title" style={{ cursor: "pointer" }} onClick={() => onOpenSubflow(subflow.id)}>{subflow.name}</h2>
                  </td>
                  <td style={{ color: "var(--fg-secondary)" }}>{subflow.description || "No description"}</td>
                  <td style={{ fontWeight: 500 }}>
                    {subflow.used_by_count}{" "}
                    {subflow.used_by_count === 1 ? "workflow" : "workflows"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "3px", justifyContent: "flex-end", alignItems: "center" }}>
                      <IconButton
                        label={`Open ${subflow.name}`}
                        type="button"
                        className="btn-action-circle"
                        onClick={() => onOpenSubflow(subflow.id)}
                      >
                        <Eye aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Settings ${subflow.name}`}
                        type="button"
                        className="btn-action-circle"
                        onClick={() => setSettingsSubflow(subflow)}
                      >
                        <Settings aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Duplicate ${subflow.name}`}
                        type="button"
                        className="btn-action-circle"
                        onClick={() => {
                          void onDuplicateSubflow(subflow);
                        }}
                      >
                        <Copy aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Export ${subflow.name}`}
                        type="button"
                        className="btn-action-circle"
                        onClick={() => onExportSubflow(subflow.id)}
                      >
                        <Download aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Delete ${subflow.name}`}
                        type="button"
                        className="btn-action-circle btn-destruct"
                        onClick={() => {
                          setDeleteSubflowCandidate(subflow);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog();
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Subflow</p>
            <DialogTitle>Create Subflow</DialogTitle>
            <DialogDescription>
              Name a reusable graph path for the current project.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={submitCreateSubflow}>
            <Label htmlFor="subflow-name">
              Subflow name
            </Label>
            <Input
              autoFocus
              id="subflow-name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.currentTarget.value)}
              placeholder="Login"
            />
            <Label htmlFor="subflow-description">
              Description
            </Label>
            <Input
              id="subflow-description"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
              placeholder="Reusable login path"
            />
            {localError ? <p className="field-error">{localError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit" disabled={creating} loading={creating}>
                Create
              </Button>
              <Button variant="secondary" type="button" disabled={creating} onClick={closeCreateDialog}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SubflowSettingsDialog
        subflow={settingsSubflow}
        onOpenChange={(open) => {
          if (!open) setSettingsSubflow(null);
        }}
        onSave={async (input) => {
          if (!settingsSubflow) return;
          await onUpdateSubflow(settingsSubflow, input);
        }}
      />
      <Dialog
        open={Boolean(deleteSubflowCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteSubflowCandidate(null);
        }}
      >
        {deleteSubflowCandidate ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Subflow</p>
              <DialogTitle>Delete Subflow</DialogTitle>
              <DialogDescription>
                This removes {deleteSubflowCandidate.name} from the app. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {error ? <p className="field-error">{error}</p> : null}
            <DialogFooter className="form-actions">
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                loading={deleting}
                onClick={async () => {
                  if (deleteSubflowCandidate) {
                    setDeleting(true);
                    try {
                      await onDeleteSubflow(deleteSubflowCandidate);
                      setDeleteSubflowCandidate(null);
                    } finally {
                      setDeleting(false);
                    }
                  }
                }}
              >
                Delete Subflow
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteSubflowCandidate(null)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
