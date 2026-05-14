import type {
  ActionConfig,
  BatchRunRequest,
  ElementSnapshot,
  OrchestrationSchedule,
  RecordedEvent,
  WorkflowBrowserConfig,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../types/workflow";

function bridge() {
  if (!window.workflowApi) {
    throw { message: "Electron workflow bridge is not available" };
  }

  return window.workflowApi;
}

export function listWorkflows() {
  return bridge().listWorkflows();
}

export function getWorkflow(id: string) {
  return bridge().getWorkflow(id);
}

export function getWorkflowBrowserConfig(workflowId: string) {
  return bridge().getWorkflowBrowserConfig(workflowId);
}

export function saveWorkflowBrowserConfig(
  workflowId: string,
  config: WorkflowBrowserConfig,
) {
  return bridge().saveWorkflowBrowserConfig(workflowId, config);
}

export function getWorkflowSettings(workflowId: string) {
  return bridge().getWorkflowSettings(workflowId);
}

export function saveWorkflowSettings(
  workflowId: string,
  settings: WorkflowSettings,
) {
  return bridge().saveWorkflowSettings(workflowId, settings);
}

export function saveWorkflowSettingsSection<
  Section extends WorkflowSettingsSectionId,
>(
  workflowId: string,
  section: Section,
  sectionValue: WorkflowSettings[Section],
) {
  return bridge().saveWorkflowSettingsSection(workflowId, section, sectionValue);
}

export function validateWorkflowSettings(settings: WorkflowSettings) {
  return bridge().validateWorkflowSettings(settings);
}

export function validateWorkflowRun(workflowId: string) {
  return bridge().validateWorkflowRun(workflowId);
}

export function createWorkflow(name: string) {
  return bridge().createWorkflow(name);
}

export function renameWorkflow(id: string, name: string) {
  return bridge().renameWorkflow(id, name);
}

export function deleteWorkflow(id: string) {
  return bridge().deleteWorkflow(id);
}

export function duplicateWorkflow(workflowId: string, name: string) {
  return bridge().duplicateWorkflow(workflowId, name);
}

export function getWorkflowGraph(workflowId: string) {
  return bridge().getWorkflowGraph(workflowId);
}

export function saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
  return bridge().saveWorkflowGraph(workflowId, graph);
}

export function validateWorkflowGraph(graph: WorkflowGraph) {
  return bridge().validateWorkflowGraph(graph);
}

export function compileWorkflowGraph(graph: WorkflowGraph) {
  return bridge().compileWorkflowGraph(graph);
}

export function runWorkflow(workflowId: string) {
  return bridge().runWorkflow(workflowId);
}

export function runWorkflowFromNode(workflowId: string, startNodeId: string) {
  return bridge().runWorkflowFromNode(workflowId, startNodeId);
}

export function stopRun() {
  return bridge().stopRun();
}

export function getRunState() {
  return bridge().getRunState();
}

export function validateSchedule(schedule: OrchestrationSchedule) {
  return bridge().validateSchedule(schedule);
}

export function exportWorkflow(workflowId: string) {
  return bridge().exportWorkflow(workflowId);
}

export function importWorkflow(exported: WorkflowExport) {
  return bridge().importWorkflow(exported);
}

export function exportWorkflowPackage(
  workflowId: string,
  options: WorkflowPackageExportOptions,
) {
  return bridge().exportWorkflowPackage(workflowId, options);
}

export function previewWorkflowPackage(packageValue: WorkflowPackage) {
  return bridge().previewWorkflowPackage(packageValue);
}

export function importWorkflowPackage(
  packageValue: WorkflowPackage,
  options: WorkflowPackageImportOptions,
) {
  return bridge().importWorkflowPackage(packageValue, options);
}

export function saveWorkflowPackageFile(packageValue: WorkflowPackage) {
  return bridge().saveWorkflowPackageFile(packageValue);
}

export function runBatchWorkflow(workflowId: string, request: BatchRunRequest) {
  return bridge().runBatchWorkflow(workflowId, request);
}

export function suggestSelectors(snapshot: ElementSnapshot) {
  return bridge().suggestSelectors(snapshot);
}

export function normalizeRecordedEvents(events: RecordedEvent[]) {
  return bridge().normalizeRecordedEvents(events);
}

export function dryRunValidateConfig(config: ActionConfig) {
  return bridge().dryRunValidateConfig(config);
}
