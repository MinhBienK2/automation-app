import type { FormEventHandler } from "react";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  PackageFlowCheckbox,
  PackageSectionPicker,
  sectionLabel,
} from "./features/workflows/components/WorkflowPackageOptions";
import type {
  ProjectPackagePreview,
  WorkflowPackagePreview,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "./types/workflow";

type AppPackageDialogsProps = {
  appError: string;
  workflowPackageSections: WorkflowSettingsSectionId[];
  exportPackageWorkflow: WorkflowSummary | null;
  exportPackageIncludeFlow: boolean;
  exportPackageSections: WorkflowSettingsSectionId[];
  onCloseExportPackageDialog: () => void;
  onSubmitExportPackage: FormEventHandler<HTMLFormElement>;
  onExportPackageIncludeFlowChange: (checked: boolean) => void;
  onExportPackageSectionsChange: (sections: WorkflowSettingsSectionId[]) => void;
  importPackagePreview: WorkflowPackagePreview | null;
  importPackageIncludeFlow: boolean;
  importPackageSections: WorkflowSettingsSectionId[];
  onCloseImportPackageDialog: () => void;
  onSubmitImportPackage: FormEventHandler<HTMLFormElement>;
  onImportPackageIncludeFlowChange: (checked: boolean) => void;
  onImportPackageSectionsChange: (sections: WorkflowSettingsSectionId[]) => void;
  isImportProjectPackageOpen: boolean;
  importProjectPackagePreview: ProjectPackagePreview | null;
  onCloseImportProjectPackageDialog: () => void;
  onSubmitImportProjectPackage: FormEventHandler<HTMLFormElement>;
  deleteWorkflowCandidate: WorkflowSummary | null;
  onConfirmDeleteWorkflow: () => void;
  onCancelDeleteWorkflow: () => void;
  isPackageActionBusy?: boolean;
  workflowDialogBusy?: boolean;
};

export function AppPackageDialogs({
  appError,
  workflowPackageSections,
  exportPackageWorkflow,
  exportPackageIncludeFlow,
  exportPackageSections,
  onCloseExportPackageDialog,
  onSubmitExportPackage,
  onExportPackageIncludeFlowChange,
  onExportPackageSectionsChange,
  importPackagePreview,
  importPackageIncludeFlow,
  importPackageSections,
  onCloseImportPackageDialog,
  onSubmitImportPackage,
  onImportPackageIncludeFlowChange,
  onImportPackageSectionsChange,
  isImportProjectPackageOpen,
  importProjectPackagePreview,
  onCloseImportProjectPackageDialog,
  onSubmitImportProjectPackage,
  deleteWorkflowCandidate,
  onConfirmDeleteWorkflow,
  onCancelDeleteWorkflow,
  isPackageActionBusy = false,
  workflowDialogBusy = false,
}: AppPackageDialogsProps) {
  return (
    <>
      <Dialog
        open={Boolean(exportPackageWorkflow)}
        onOpenChange={(open) => {
          if (!open) onCloseExportPackageDialog();
        }}
      >
        <DialogContent className="workflow-dialog max-w-none">
          <DialogHeader>
            <p className="eyebrow">Package</p>
            <DialogTitle>Export Workflow</DialogTitle>
            <DialogDescription>
              Choose the workflow parts to include in the JSON package.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={onSubmitExportPackage}>
            <PackageFlowCheckbox
              checked={exportPackageIncludeFlow}
              label="Flow"
              onChange={onExportPackageIncludeFlowChange}
            />
            <PackageSectionPicker
              availableSections={workflowPackageSections}
              selectedSections={exportPackageSections}
              onSelectedSectionsChange={onExportPackageSectionsChange}
            />
            {appError ? <p className="field-error">{appError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit" disabled={isPackageActionBusy} loading={isPackageActionBusy}>
                Export
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={isPackageActionBusy}
                onClick={onCloseExportPackageDialog}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(importPackagePreview)}
        onOpenChange={(open) => {
          if (!open) onCloseImportPackageDialog();
        }}
      >
        <DialogContent className="workflow-dialog max-w-none">
          <DialogHeader>
            <p className="eyebrow">Package</p>
            <DialogTitle>Import Workflow</DialogTitle>
            <DialogDescription>
              Import creates a new workflow and never overwrites an existing one.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={onSubmitImportPackage}>
            <dl className="package-preview-list">
              <div>
                <dt>Name</dt>
                <dd>{importPackagePreview?.workflow_name || ""}</dd>
              </div>
              <div>
                <dt>Included</dt>
                <dd>
                  {[
                    importPackagePreview?.includes_flow ? "Flow" : null,
                    ...(importPackagePreview?.settings_sections ?? []).map(sectionLabel),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            </dl>
            <PackageFlowCheckbox
              checked={importPackageIncludeFlow}
              disabled={!importPackagePreview?.includes_flow}
              label="Flow"
              onChange={onImportPackageIncludeFlowChange}
            />
            <PackageSectionPicker
              availableSections={importPackagePreview?.settings_sections ?? []}
              selectedSections={importPackageSections}
              onSelectedSectionsChange={onImportPackageSectionsChange}
            />
            {importPackagePreview && importPackagePreview.omitted_fields.length > 0 ? (
              <p className="muted">
                Sanitized fields: {importPackagePreview.omitted_fields.join(", ")}
              </p>
            ) : null}
            {appError ? <p className="field-error">{appError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit" disabled={isPackageActionBusy} loading={isPackageActionBusy}>
                Import
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={isPackageActionBusy}
                onClick={onCloseImportPackageDialog}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportProjectPackageOpen}
        onOpenChange={(open) => {
          if (!open) onCloseImportProjectPackageDialog();
        }}
      >
        <DialogContent className="workflow-dialog max-w-none">
          <DialogHeader>
            <p className="eyebrow">Package</p>
            <DialogTitle>Import Project</DialogTitle>
            <DialogDescription>
              Import creates a new project and never overwrites an existing one.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={onSubmitImportProjectPackage}>
            <dl className="package-preview-list">
              <div>
                <dt>Name</dt>
                <dd>{importProjectPackagePreview?.project_name || ""}</dd>
              </div>
              <div>
                <dt>Workflows</dt>
                <dd>
                  {importProjectPackagePreview && importProjectPackagePreview.workflows.length > 0
                    ? importProjectPackagePreview.workflows
                        .map((workflow) => workflow.name)
                        .join(", ")
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Subflows</dt>
                <dd>{importProjectPackagePreview?.subflows.length ?? 0}</dd>
              </div>
              <div>
                <dt>Sessions</dt>
                <dd>
                  {(importProjectPackagePreview?.browser_profiles ?? []).length}
                </dd>
              </div>
            </dl>
            {importProjectPackagePreview && importProjectPackagePreview.omitted_fields.length > 0 ? (
              <p className="muted">
                Sanitized fields: {importProjectPackagePreview.omitted_fields.join(", ")}
              </p>
            ) : null}
            {appError ? <p className="field-error">{appError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit" disabled={isPackageActionBusy} loading={isPackageActionBusy}>
                Import
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={isPackageActionBusy}
                onClick={onCloseImportProjectPackageDialog}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteWorkflowCandidate)}
        onOpenChange={(open) => {
          if (!open) onCancelDeleteWorkflow();
        }}
      >
        <DialogContent className="workflow-dialog max-w-none">
          <DialogHeader>
            <p className="eyebrow">Workflow</p>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              This removes {deleteWorkflowCandidate?.name || ""} from the app. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {appError ? <p className="field-error">{appError}</p> : null}
          <DialogFooter className="form-actions">
            <Button
              type="button"
              variant="destructive"
              disabled={workflowDialogBusy}
              loading={workflowDialogBusy}
              onClick={onConfirmDeleteWorkflow}
            >
              Delete Workflow
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={workflowDialogBusy}
              onClick={onCancelDeleteWorkflow}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
