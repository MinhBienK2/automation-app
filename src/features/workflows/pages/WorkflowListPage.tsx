import { CircleDot, Copy, Download, Eye, Pencil, Play, Square, Trash2, Upload } from "lucide-react";
import { Select } from "../../../components/ui/select";
import type { BrowserProfile, RunState, WorkflowRunSnapshot, WorkflowSummary } from "../../../types/workflow";
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
import { Label } from "../../../components/ui/label";
import { runStatusLabel } from "../../../lib/workflowUi";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  browserProfiles: BrowserProfile[];
  selectedProfileIdDraft: string | null;
  appError: string;
  runState: RunState;
  runSnapshots: WorkflowRunSnapshot[];
  activeRunWorkflowName?: string | null;
  onWorkflowNameDraftChange: (name: string) => void;
  onSelectedProfileIdDraftChange: (id: string | null) => void;
  onSubmitWorkflowDialog: (event: React.FormEvent) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowSummary) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onRunWorkflow: (workflow: WorkflowSummary) => void;
  onStopRun: (runId: string) => void;
  onOpenExportWorkflow: (workflow: WorkflowSummary) => void;
  onImportWorkflowPackageFile: (file: File | null) => void;
  onRecordWorkflow: () => void;
  onCloseWorkflowDialog: () => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
};

export function WorkflowListPage({
  workflows,
  workflowDialogMode,
  workflowNameDraft,
  browserProfiles,
  selectedProfileIdDraft,
  appError,
  runState,
  runSnapshots,
  activeRunWorkflowName,
  onWorkflowNameDraftChange,
  onSelectedProfileIdDraftChange,
  onSubmitWorkflowDialog,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onDuplicateWorkflow,
  onRunWorkflow,
  onStopRun,
  onOpenExportWorkflow,
  onImportWorkflowPackageFile,
  onRecordWorkflow,
  onCloseWorkflowDialog,
  onOpenWorkflow,
  onDeleteWorkflow,
}: WorkflowListPageProps) {
  const workflowDialogTitle =
    workflowDialogMode === "create" ? "Create Workflow" : "Edit Workflow";
  const workflowDialogDescription =
    workflowDialogMode === "create"
      ? "Name the workflow before building its automation graph."
      : "Rename the workflow without changing its graph.";
  const workflowNameLabel =
    workflowDialogMode === "create" ? "New workflow name" : "Workflow name";
  const activeRunsByWorkflow = new Map(
    runSnapshots
      .filter((snapshot) => snapshot.state.status === "running")
      .map((snapshot) => [snapshot.workflow_id, snapshot]),
  );
  const runStatusText =
    runState.status === "idle"
      ? null
      : `${runStatusLabel(runState)}${activeRunWorkflowName ? `: ${activeRunWorkflowName}` : ""}`;

  return (
    <section className="app-screen workflow-list-screen">
      <header className="app-header">
        <div>
          <h1>Workflows</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Workflow summary">
            <span>{workflows.length} workflows</span>
          </div>
          <label className="workflow-import-button">
            <Upload aria-hidden="true" />
            Import Workflow
            <input
              aria-label="Workflow package file"
              className="workflow-package-file-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onImportWorkflowPackageFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button variant="secondary" shape="pill" type="button" onClick={onRecordWorkflow}>
            <CircleDot aria-hidden="true" />
            Record Workflow
          </Button>
          <Button shape="pill" type="button" onClick={onOpenCreateWorkflow}>
            Create Workflow
          </Button>
        </div>
        {appError ? (
          <p className="field-error" role="alert">
            {appError}
          </p>
        ) : null}
        {runStatusText ? (
          <p className="muted" role="status">
            {runStatusText}
          </p>
        ) : null}
      </header>

      <section className="workflow-library" aria-label="Workflow list">
        {workflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No workflows yet</h2>
            <p className="muted">Create one to begin building an automation graph.</p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const activeRun = activeRunsByWorkflow.get(workflow.id);
            const hasActiveRun = Boolean(activeRun);
            return (
              <Card className="workflow-card" key={workflow.id}>
                <div className="workflow-card-main">
                  <div>
                    <h2>{workflow.name}</h2>
                    {activeRun ? (
                      <p className="muted workflow-row-run-status" role="status">
                        {runStatusLabel(activeRun.state)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="row-actions">
                  <IconButton
                    label="View Details"
                    type="button"
                    onClick={() => onOpenWorkflow(workflow.id)}
                  >
                    <Eye aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Run ${workflow.name}`}
                    type="button"
                    variant="secondary"
                    disabled={hasActiveRun}
                    onClick={() => onRunWorkflow(workflow)}
                  >
                    <Play aria-hidden="true" />
                  </IconButton>
                  {activeRun ? (
                    <IconButton
                      label={`Stop ${workflow.name}`}
                      type="button"
                      variant="destructive"
                      onClick={() => onStopRun(activeRun.run_id)}
                    >
                      <Square aria-hidden="true" />
                    </IconButton>
                  ) : null}
                  <IconButton
                    variant="secondary"
                    type="button"
                    label={`Edit ${workflow.name}`}
                    onClick={() => onOpenEditWorkflow(workflow)}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Duplicate ${workflow.name}`}
                    type="button"
                    variant="secondary"
                    disabled={hasActiveRun}
                    onClick={() => onDuplicateWorkflow(workflow)}
                  >
                    <Copy aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Export ${workflow.name}`}
                    type="button"
                    variant="secondary"
                    disabled={hasActiveRun}
                    onClick={() => onOpenExportWorkflow(workflow)}
                  >
                    <Download aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${workflow.name}`}
                    type="button"
                    variant="destructive"
                    disabled={hasActiveRun}
                    onClick={() => onDeleteWorkflow(workflow.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <Dialog
        open={Boolean(workflowDialogMode)}
        onOpenChange={(open) => {
          if (!open) onCloseWorkflowDialog();
        }}
      >
        {workflowDialogMode ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Workflow</p>
              <DialogTitle>{workflowDialogTitle}</DialogTitle>
              <DialogDescription>{workflowDialogDescription}</DialogDescription>
            </DialogHeader>

            <form className="workflow-dialog-form" onSubmit={onSubmitWorkflowDialog}>
              <Label htmlFor="workflow-name">
                {workflowNameLabel}
              </Label>
              <Input
                autoFocus
                id="workflow-name"
                value={workflowNameDraft}
                onChange={(event) =>
                  onWorkflowNameDraftChange(event.currentTarget.value)
                }
                placeholder="Login flow"
              />
              {workflowDialogMode === "create" ? (
                <>
                  <Label htmlFor="workflow-profile">
                    Browser Profile
                  </Label>
                  <Select
                    id="workflow-profile"
                    value={selectedProfileIdDraft ?? ""}
                    onChange={(event) =>
                      onSelectedProfileIdDraftChange(event.currentTarget.value || null)
                    }
                  >
                    {browserProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </>
              ) : null}
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  {workflowDialogMode === "create" ? "Create" : "Save Changes"}
                </Button>
                <Button variant="secondary" type="button" onClick={onCloseWorkflowDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
