import { invoke } from "@tauri-apps/api/core";
import type {
  ActionConfig,
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  ElementSnapshot,
  GeneratedFixture,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunValidationIssue,
  RunState,
  SelectorCandidate,
  SettingsValidationIssue,
  WorkflowBrowserConfig,
  WorkflowGraph,
  Workflow,
  WorkflowDetail,
  WorkflowExport,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../types/workflow";

export function listWorkflows() {
  return invoke<WorkflowSummary[]>("list_workflows");
}

export function getWorkflow(id: string) {
  return invoke<WorkflowDetail | null>("get_workflow", { id });
}

export function getWorkflowBrowserConfig(workflowId: string) {
  return invoke<WorkflowBrowserConfig>("get_workflow_browser_config", { workflowId });
}

export function saveWorkflowBrowserConfig(
  workflowId: string,
  config: WorkflowBrowserConfig,
) {
  return invoke("save_workflow_browser_config", { workflowId, config });
}

export function getWorkflowSettings(workflowId: string) {
  return invoke<WorkflowSettings>("get_workflow_settings", { workflowId });
}

export function saveWorkflowSettings(
  workflowId: string,
  settings: WorkflowSettings,
) {
  return invoke<WorkflowSettings>("save_workflow_settings", { workflowId, settings });
}

export function saveWorkflowSettingsSection<
  Section extends WorkflowSettingsSectionId,
>(
  workflowId: string,
  section: Section,
  sectionValue: WorkflowSettings[Section],
) {
  return invoke<WorkflowSettings>("save_workflow_settings_section", {
    workflowId,
    section,
    sectionValue,
  });
}

export function validateWorkflowSettings(settings: WorkflowSettings) {
  return invoke<SettingsValidationIssue[]>("validate_workflow_settings", {
    settings,
  });
}

export function validateWorkflowRun(workflowId: string) {
  return invoke<RunValidationIssue[]>("validate_workflow_run", { workflowId });
}

export function createWorkflow(name: string) {
  return invoke<Workflow>("create_workflow", { name });
}

export function renameWorkflow(id: string, name: string) {
  return invoke("rename_workflow", { id, name });
}

export function deleteWorkflow(id: string) {
  return invoke("delete_workflow", { id });
}

export function getWorkflowGraph(workflowId: string) {
  return invoke<WorkflowGraph>("get_workflow_graph", { workflowId });
}

export function saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
  return invoke("save_workflow_graph", { workflowId, graph });
}

export function validateWorkflowGraph(graph: WorkflowGraph) {
  return invoke<GraphValidationIssue[]>("validate_workflow_graph", { graph });
}

export function compileWorkflowGraph(graph: WorkflowGraph) {
  return invoke<CompiledWorkflowGraph>("compile_workflow_graph", { graph });
}

export function runWorkflow(workflowId: string) {
  return invoke<RunState>("run_workflow", { workflowId });
}

export function stopRun() {
  return invoke<RunState>("stop_run");
}

export function getRunState() {
  return invoke<RunState>("get_run_state");
}

export function validateSchedule(schedule: OrchestrationSchedule) {
  return invoke<OrchestrationSchedule>("validate_schedule", { schedule });
}

export function exportWorkflow(workflowId: string) {
  return invoke<WorkflowExport>("export_workflow", { workflowId });
}

export function importWorkflow(exported: WorkflowExport) {
  return invoke<WorkflowDetail>("import_workflow", { exported });
}

export function exportWorkflowPackage(
  workflowId: string,
  options: WorkflowPackageExportOptions,
) {
  return invoke<WorkflowPackage>("export_workflow_package", { workflowId, options });
}

export function previewWorkflowPackage(packageValue: WorkflowPackage) {
  return invoke<WorkflowPackagePreview>("preview_workflow_package", {
    package: packageValue,
  });
}

export function importWorkflowPackage(
  packageValue: WorkflowPackage,
  options: WorkflowPackageImportOptions,
) {
  return invoke<WorkflowDetail>("import_workflow_package", {
    package: packageValue,
    options,
  });
}

export function runBatchWorkflow(workflowId: string, request: BatchRunRequest) {
  return invoke<BatchRunSummary>("run_batch_workflow", { workflowId, request });
}

export function suggestSelectors(snapshot: ElementSnapshot) {
  return invoke<SelectorCandidate[]>("suggest_selectors", { snapshot });
}

export function normalizeRecordedEvents(events: RecordedEvent[]) {
  return invoke<ActionConfig[]>("normalize_recorded_events", { events });
}

export function dryRunValidateConfig(config: ActionConfig) {
  return invoke("dry_run_validate_config", { config });
}

export function generateFixture(path: string, bodyHtml: string) {
  return invoke<GeneratedFixture>("generate_fixture", { path, bodyHtml });
}
