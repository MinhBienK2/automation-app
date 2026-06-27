import { useMemo, useState } from "react";
import {
  CircleDot,
  Copy,
  Download,
  Eye,
  Pencil,
  Play,
  Square,
  Trash2,
  Upload,
  Search,
} from "lucide-react";
import { Select } from "../../../components/ui/select";
import type { BrowserProfile, WorkflowRunSnapshot, WorkflowSummary } from "../../../types/workflow";
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
import { Label } from "../../../components/ui/label";
import { runStatusLabel } from "../../../lib/workflowUi";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  browserProfiles: BrowserProfile[];
  selectedProfileIdDraft: string | null;
  appError: string;
  runSnapshots: WorkflowRunSnapshot[];
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
  runSnapshots,
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredWorkflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return workflows;
    return workflows.filter((wf) => wf.name.toLowerCase().includes(query));
  }, [workflows, searchQuery]);

  return (
    <div className="tab-content-area">
      <h1 className="sr-only">Workflows</h1>
      {appError ? (
        <p className="field-error" role="alert">
          {appError}
        </p>
      ) : null}

      {/* Toolbar Filter */}
      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search aria-hidden="true" />
          <Input
            className="text-input"
            style={{ paddingLeft: 32 }}
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
      </div>

      {/* Workflows Table */}
      <section className="workflow-library data-table-card" aria-label="Workflow list">
        {filteredWorkflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No workflows yet</h2>
            <p className="muted">Create one to begin building an automation graph.</p>
          </div>
        ) : (
          <table className="grid-table">
            <thead>
              <tr>
                <th>WORKFLOW</th>
                <th style={{ textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkflows.map((workflow) => {
                const activeRun = activeRunsByWorkflow.get(workflow.id);
                const hasActiveRun = Boolean(activeRun);
                return (
                  <tr key={workflow.id} className="grid-row" data-slot="card">
                    <td>
                      <div className="row-title-cell">
                        <h2
                          className="row-title"
                          style={{ cursor: "pointer" }}
                          onClick={() => onOpenWorkflow(workflow.id)}
                        >
                          {workflow.name}
                        </h2>
                        <span className="row-desc">
                          {activeRun ? (
                            <span className="badge badge-running">
                              <span className="dot-pulse" />
                              {runStatusLabel(activeRun.state)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "3px", justifyContent: "flex-end", alignItems: "center" }}>
                        <IconButton
                          label="View Details"
                          type="button"
                          className="btn-action-circle"
                          onClick={() => onOpenWorkflow(workflow.id)}
                        >
                          <Eye aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`Run ${workflow.name}`}
                          type="button"
                          className="btn-action-circle"
                          disabled={hasActiveRun}
                          onClick={() => onRunWorkflow(workflow)}
                        >
                          <Play aria-hidden="true" />
                        </IconButton>
                        {activeRun ? (
                          <IconButton
                            label={`Stop ${workflow.name}`}
                            type="button"
                            className="btn-action-circle btn-destruct"
                            onClick={() => onStopRun(activeRun.run_id)}
                          >
                            <Square aria-hidden="true" />
                          </IconButton>
                        ) : null}
                        <IconButton
                          className="btn-action-circle"
                          type="button"
                          label={`Edit ${workflow.name}`}
                          onClick={() => onOpenEditWorkflow(workflow)}
                        >
                          <Pencil aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`Duplicate ${workflow.name}`}
                          type="button"
                          className="btn-action-circle"
                          disabled={hasActiveRun}
                          onClick={() => onDuplicateWorkflow(workflow)}
                        >
                          <Copy aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`Export ${workflow.name}`}
                          type="button"
                          className="btn-action-circle"
                          disabled={hasActiveRun}
                          onClick={() => onOpenExportWorkflow(workflow)}
                        >
                          <Download aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`Delete ${workflow.name}`}
                          type="button"
                          className="btn-action-circle btn-destruct"
                          disabled={hasActiveRun}
                          onClick={() => onDeleteWorkflow(workflow.id)}
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
    </div>
  );
}
