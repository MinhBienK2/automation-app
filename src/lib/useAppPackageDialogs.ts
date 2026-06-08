import { useState, type FormEvent } from "react";
import type {
  Project,
  ProjectPackage,
  ProjectPackagePreview,
  WorkflowPackage,
  WorkflowPackagePreview,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../types/workflow";
import {
  exportProjectPackage,
  exportWorkflowPackage,
  importProjectPackage,
  importWorkflowPackage,
  previewProjectPackage,
  previewWorkflowPackage,
  saveProjectPackageFile,
  saveWorkflowPackageFile,
} from "./workflowApi";
import { commandMessage } from "./workflowUi";

export const workflowPackageSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];

const workflowPackageFileSizeLimitBytes = 5 * 1024 * 1024;
const projectPackageFileSizeLimitBytes = 20 * 1024 * 1024;
const toastTimeoutMs = 2200;

type UseAppPackageDialogsOptions = {
  currentProjectId: () => string | null;
  onProjectImported: (project: Project) => void | Promise<void>;
  onWorkflowImported: (workflowId: string) => void | Promise<void>;
  setAppError: (message: string) => void;
  setToastMessage: (message: string) => void;
};

export function useAppPackageDialogs({
  currentProjectId,
  onProjectImported,
  onWorkflowImported,
  setAppError,
  setToastMessage,
}: UseAppPackageDialogsOptions) {
  const [exportPackageWorkflow, setExportPackageWorkflow] =
    useState<WorkflowSummary | null>(null);
  const [exportPackageIncludeFlow, setExportPackageIncludeFlow] = useState(true);
  const [exportPackageSections, setExportPackageSections] =
    useState<WorkflowSettingsSectionId[]>(workflowPackageSections);
  const [importPackage, setImportPackage] = useState<WorkflowPackage | null>(null);
  const [importPackagePreview, setImportPackagePreview] =
    useState<WorkflowPackagePreview | null>(null);
  const [importPackageIncludeFlow, setImportPackageIncludeFlow] = useState(true);
  const [importPackageSections, setImportPackageSections] =
    useState<WorkflowSettingsSectionId[]>([]);
  const [importProjectPackageValue, setImportProjectPackageValue] =
    useState<ProjectPackage | null>(null);
  const [importProjectPackagePreview, setImportProjectPackagePreview] =
    useState<ProjectPackagePreview | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), toastTimeoutMs);
  }

  function openExportPackageDialog(workflow: WorkflowSummary) {
    setAppError("");
    setExportPackageWorkflow(workflow);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
  }

  function closeExportPackageDialog() {
    setExportPackageWorkflow(null);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
    setAppError("");
  }

  async function submitExportPackage(event: FormEvent) {
    event.preventDefault();
    if (!exportPackageWorkflow) return;
    if (!exportPackageIncludeFlow && exportPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const packageValue = await exportWorkflowPackage(exportPackageWorkflow.id, {
        include_flow: exportPackageIncludeFlow,
        settings_sections: exportPackageSections,
      });
      const filePath = await saveWorkflowPackageFile(packageValue);
      if (!filePath) return;
      closeExportPackageDialog();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function importWorkflowPackageFile(file: File | null) {
    if (!file) return;
    setAppError("");
    if (file.size > workflowPackageFileSizeLimitBytes) {
      setAppError("Workflow package file must be 5 MB or smaller");
      return;
    }

    try {
      const packageValue = JSON.parse(await file.text()) as WorkflowPackage;
      const preview = await previewWorkflowPackage(packageValue);
      setImportPackage(packageValue);
      setImportPackagePreview(preview);
      setImportPackageIncludeFlow(preview.includes_flow);
      setImportPackageSections(preview.settings_sections);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function closeImportPackageDialog() {
    setImportPackage(null);
    setImportPackagePreview(null);
    setImportPackageIncludeFlow(true);
    setImportPackageSections([]);
    setAppError("");
  }

  async function submitImportPackage(event: FormEvent) {
    event.preventDefault();
    if (!importPackage) return;
    if (!importPackageIncludeFlow && importPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const imported = await importWorkflowPackage(importPackage, {
        include_flow: importPackageIncludeFlow,
        settings_sections: importPackageSections,
        target_project_id: currentProjectId(),
      });
      closeImportPackageDialog();
      await onWorkflowImported(imported.workflow.id);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function exportProjectPackageFile(projectId: string) {
    setAppError("");
    try {
      const packageValue = await exportProjectPackage(projectId);
      const filePath = await saveProjectPackageFile(packageValue);
      if (!filePath) return;
      showToast("Project exported.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function importProjectPackageFile(file: File | null) {
    if (!file) return;
    setAppError("");
    if (file.size > projectPackageFileSizeLimitBytes) {
      setAppError("Project package file must be 20 MB or smaller");
      return;
    }

    try {
      const packageValue = JSON.parse(await file.text()) as ProjectPackage;
      const preview = await previewProjectPackage(packageValue);
      setImportProjectPackageValue(packageValue);
      setImportProjectPackagePreview(preview);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function closeImportProjectPackageDialog() {
    setImportProjectPackageValue(null);
    setImportProjectPackagePreview(null);
    setAppError("");
  }

  async function submitImportProjectPackage(event: FormEvent) {
    event.preventDefault();
    if (!importProjectPackageValue) return;
    setAppError("");

    try {
      const project = await importProjectPackage(importProjectPackageValue);
      closeImportProjectPackageDialog();
      await onProjectImported(project);
      showToast("Project imported.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  return {
    exportPackageWorkflow,
    exportPackageIncludeFlow,
    exportPackageSections,
    setExportPackageIncludeFlow,
    setExportPackageSections,
    importPackagePreview,
    importPackageIncludeFlow,
    importPackageSections,
    setImportPackageIncludeFlow,
    setImportPackageSections,
    importProjectPackagePreview,
    isImportProjectPackageOpen: Boolean(importProjectPackageValue && importProjectPackagePreview),
    openExportPackageDialog,
    closeExportPackageDialog,
    submitExportPackage,
    importWorkflowPackageFile,
    closeImportPackageDialog,
    submitImportPackage,
    exportProjectPackageFile,
    importProjectPackageFile,
    closeImportProjectPackageDialog,
    submitImportProjectPackage,
  };
}
