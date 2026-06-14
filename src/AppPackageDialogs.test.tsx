import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { WorkflowSettingsSectionId, WorkflowSummary } from "./types/workflow";
import { AppPackageDialogs } from "./AppPackageDialogs";

const workflow: WorkflowSummary = {
  id: "workflow-1",
  project_id: "project-1",
  name: "Login flow",
  step_count: 2,
  browser_profile_id: null,
  browser_profile_name: null,
  created_at: "2026-05-27T00:00:00.000Z",
  updated_at: "2026-05-27T00:00:00.000Z",
};

const defaultWorkflowPackageSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];

const defaultProps = {
  appError: "",
  workflowPackageSections: defaultWorkflowPackageSections,
  exportPackageWorkflow: null,
  exportPackageIncludeFlow: true,
  exportPackageSections: ["general"] as WorkflowSettingsSectionId[],
  onCloseExportPackageDialog: vi.fn(),
  onSubmitExportPackage: vi.fn(),
  onExportPackageIncludeFlowChange: vi.fn(),
  onExportPackageSectionsChange: vi.fn(),
  importPackagePreview: null,
  importPackageIncludeFlow: true,
  importPackageSections: [],
  onCloseImportPackageDialog: vi.fn(),
  onSubmitImportPackage: vi.fn(),
  onImportPackageIncludeFlowChange: vi.fn(),
  onImportPackageSectionsChange: vi.fn(),
  isImportProjectPackageOpen: false,
  importProjectPackagePreview: null,
  onCloseImportProjectPackageDialog: vi.fn(),
  onSubmitImportProjectPackage: vi.fn(),
  deleteWorkflowCandidate: null,
  onConfirmDeleteWorkflow: vi.fn(),
  onCancelDeleteWorkflow: vi.fn(),
};

describe("AppPackageDialogs", () => {
  test("renders and cancels the delete workflow confirmation", async () => {
    const onCancelDeleteWorkflow = vi.fn();

    render(
      <AppPackageDialogs
        {...defaultProps}
        deleteWorkflowCandidate={workflow}
        onCancelDeleteWorkflow={onCancelDeleteWorkflow}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Delete Workflow" }))
      .toHaveTextContent("Login flow");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancelDeleteWorkflow).toHaveBeenCalled();
  });
});
