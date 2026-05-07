import { Copy, Download, Eye, Pencil, Trash2, Upload } from "lucide-react";
import type { WorkflowSummary } from "../../../types/workflow";
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

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  appError: string;
  onWorkflowNameDraftChange: (name: string) => void;
  onSubmitWorkflowDialog: (event: React.FormEvent) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowSummary) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onOpenExportWorkflow: (workflow: WorkflowSummary) => void;
  onImportWorkflowPackageFile: (file: File | null) => void;
  onCloseWorkflowDialog: () => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
};

export function WorkflowListPage({
  workflows,
  workflowDialogMode,
  workflowNameDraft,
  appError,
  onWorkflowNameDraftChange,
  onSubmitWorkflowDialog,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onDuplicateWorkflow,
  onOpenExportWorkflow,
  onImportWorkflowPackageFile,
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

  return (
    <section className="app-screen workflow-list-screen">
      <header className="app-header">
        <div>
          <p className="eyebrow">Workflow Automation Manager</p>
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
          <Button shape="pill" type="button" onClick={onOpenCreateWorkflow}>
            Create Workflow
          </Button>
        </div>
      </header>

      <section className="workflow-library" aria-label="Workflow list">
        {workflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No workflows yet</h2>
            <p className="muted">Create one to begin building an automation graph.</p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <Card className="workflow-card" key={workflow.id}>
              <div className="workflow-card-main">
                <div>
                  <h2>{workflow.name}</h2>
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
                  onClick={() => onDuplicateWorkflow(workflow)}
                >
                  <Copy aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Export ${workflow.name}`}
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenExportWorkflow(workflow)}
                >
                  <Download aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Delete ${workflow.name}`}
                  type="button"
                  variant="destructive"
                  onClick={() => onDeleteWorkflow(workflow.id)}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            </Card>
          ))
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
