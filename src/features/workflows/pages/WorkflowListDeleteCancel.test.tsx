import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AppPackageDialogs } from "../../../AppPackageDialogs";
import type { WorkflowSettingsSectionId, WorkflowSummary } from "../../../types/workflow";
import { WorkflowListPage } from "./WorkflowListPage";

const workflow: WorkflowSummary = {
  surface: "web" as const,
  id: "workflow-1",
  project_id: "project-1",
  name: "Login flow",
  step_count: 2,
  browser_profile_id: null,
  browser_profile_name: null,
  created_at: "2026-05-27T00:00:00.000Z",
  updated_at: "2026-05-27T00:00:00.000Z",
};

const workflowPackageSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];

function WorkflowDeleteCancelHarness() {
  const [deleteWorkflowCandidate, setDeleteWorkflowCandidate] =
    useState<WorkflowSummary | null>(null);
  const [workflowDialogMode, setWorkflowDialogMode] =
    useState<"create" | "edit" | null>(null);

  return (
    <>
      <WorkflowListPage
        workflows={[workflow]}
        workflowDialogMode={workflowDialogMode}
        workflowNameDraft=""
        browserProfiles={[]}
        selectedProfileIdDraft={null}
        appError=""
        runSnapshots={[]}
        onWorkflowNameDraftChange={vi.fn()}
        onSelectedProfileIdDraftChange={vi.fn()}
        onSubmitWorkflowDialog={vi.fn((event) => event.preventDefault())}
        onOpenCreateWorkflow={() => setWorkflowDialogMode("create")}
        onOpenEditWorkflow={vi.fn()}
        onDuplicateWorkflow={vi.fn()}
        onRunWorkflow={vi.fn()}
        onStopRun={vi.fn()}
        onOpenExportWorkflow={vi.fn()}
        onImportWorkflowPackageFile={vi.fn()}
        onRecordWorkflow={vi.fn()}
        onCloseWorkflowDialog={() => setWorkflowDialogMode(null)}
        onOpenWorkflow={vi.fn()}
        onDeleteWorkflow={() => setDeleteWorkflowCandidate(workflow)}
      />
      <AppPackageDialogs
        appError=""
        workflowPackageSections={workflowPackageSections}
        exportPackageWorkflow={null}
        exportPackageIncludeFlow
        exportPackageSections={["general"]}
        onCloseExportPackageDialog={vi.fn()}
        onSubmitExportPackage={vi.fn()}
        onExportPackageIncludeFlowChange={vi.fn()}
        onExportPackageSectionsChange={vi.fn()}
        importPackagePreview={null}
        importPackageIncludeFlow
        importPackageSections={[]}
        onCloseImportPackageDialog={vi.fn()}
        onSubmitImportPackage={vi.fn()}
        onImportPackageIncludeFlowChange={vi.fn()}
        onImportPackageSectionsChange={vi.fn()}
        isImportProjectPackageOpen={false}
        importProjectPackagePreview={null}
        onCloseImportProjectPackageDialog={vi.fn()}
        onSubmitImportProjectPackage={vi.fn()}
        deleteWorkflowCandidate={deleteWorkflowCandidate}
        onConfirmDeleteWorkflow={vi.fn()}
        onCancelDeleteWorkflow={() => setDeleteWorkflowCandidate(null)}
      />
    </>
  );
}

describe("Workflow list delete cancellation", () => {
  test("keeps the workflow list interactive after canceling delete from the actions menu", async () => {
    render(<WorkflowDeleteCancelHarness />);

    await userEvent.click(screen.getByRole("button", {
      name: "More actions for Login flow",
    }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    const deleteDialog = await screen.findByRole("dialog", { name: "Delete Workflow" });
    await userEvent.click(within(deleteDialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete Workflow" }))
        .not.toBeInTheDocument();
    });
    expect(document.body).not.toHaveStyle({ pointerEvents: "none" });

    await userEvent.click(screen.getByRole("button", { name: "Create Workflow" }));

    expect(await screen.findByRole("dialog", { name: "Create Workflow" }))
      .toBeInTheDocument();
  });
});
