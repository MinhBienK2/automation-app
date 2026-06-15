import { Copy, Eye, Plus, RefreshCw, Settings, Trash2, Download, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
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

  async function submitCreateSubflow(event: React.FormEvent) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      setLocalError("Subflow name is required");
      return;
    }
    await onCreateSubflow({
      name,
      description: descriptionDraft.trim() || null,
    });
    setCreateDialogOpen(false);
    setNameDraft("");
    setDescriptionDraft("");
    setLocalError("");
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setNameDraft("");
    setDescriptionDraft("");
    setLocalError("");
  }

  return (
    <section className="app-screen workflow-list-screen">
      <header className="app-header">
        <div>
          <h1>Subflows</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Subflow summary">
            <span>{subflows.length} subflows</span>
          </div>
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
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="workflow-library" aria-label="Subflow list">
        {subflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No subflows yet</h2>
            <p className="muted">Create one to reuse graph paths across workflows.</p>
          </div>
        ) : (
          subflows.map((subflow) => (
            <Card className="workflow-card subflow-card" key={subflow.id}>
              <div className="workflow-card-main">
                <div>
                  <h2>{subflow.name}</h2>
                  {subflow.description ? (
                    <p className="muted">{subflow.description}</p>
                  ) : null}
                  <p className="muted">
                    {subflow.used_by_count}{" "}
                    {subflow.used_by_count === 1 ? "workflow" : "workflows"}
                  </p>
                </div>
              </div>
              <div className="row-actions">
                <IconButton
                  label={`Open ${subflow.name}`}
                  type="button"
                  onClick={() => onOpenSubflow(subflow.id)}
                >
                  <Eye aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Settings ${subflow.name}`}
                  type="button"
                  variant="secondary"
                  onClick={() => setSettingsSubflow(subflow)}
                >
                  <Settings aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Duplicate ${subflow.name}`}
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void onDuplicateSubflow(subflow);
                  }}
                >
                  <Copy aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Export ${subflow.name}`}
                  type="button"
                  variant="secondary"
                  onClick={() => onExportSubflow(subflow.id)}
                >
                  <Download aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Delete ${subflow.name}`}
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteSubflowCandidate(subflow);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            </Card>
          ))
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
              <Button shape="pill" type="submit">
                Create
              </Button>
              <Button variant="secondary" type="button" onClick={closeCreateDialog}>
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
                onClick={async () => {
                  if (deleteSubflowCandidate) {
                    await onDeleteSubflow(deleteSubflowCandidate);
                    setDeleteSubflowCandidate(null);
                  }
                }}
              >
                Delete Subflow
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteSubflowCandidate(null)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
