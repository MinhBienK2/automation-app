import type {
  ActionConfig,
  BatchRunRequest,
  OrchestrationSchedule,
  RecorderStartSessionInput,
  WorkflowBrowserConfig,
  WorkflowDeleteOptions,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
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

export function resetWorkflowBrowserIdentity(workflowId: string) {
  return bridge().resetWorkflowBrowserIdentity(workflowId);
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

export function getCloakBrowserDiagnostics() {
  return bridge().getCloakBrowserDiagnostics();
}

export function installCloakBrowserBinary() {
  return bridge().installCloakBrowserBinary();
}

export function cleanupOrphanedBrowserProfiles() {
  return bridge().cleanupOrphanedBrowserProfiles();
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

export function deleteWorkflow(id: string, options?: WorkflowDeleteOptions) {
  return bridge().deleteWorkflow(id, options);
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

export function stopRun(runId?: string | null) {
  return bridge().stopRun(runId);
}

export function getRunState() {
  return bridge().getRunState();
}

export function listRunStates() {
  return bridge().listRunStates();
}

export function listSchedules() {
  return bridge().listSchedules();
}

export function getSchedule(scheduleId: string) {
  return bridge().getSchedule(scheduleId);
}

export function createSchedule(input: WorkflowScheduleInput) {
  return bridge().createSchedule(input);
}

export function updateSchedule(
  scheduleId: string,
  patch: WorkflowScheduleUpdate,
) {
  return bridge().updateSchedule(scheduleId, patch);
}

export function deleteSchedule(scheduleId: string) {
  return bridge().deleteSchedule(scheduleId);
}

export function enableSchedule(scheduleId: string) {
  return bridge().enableSchedule(scheduleId);
}

export function disableSchedule(scheduleId: string) {
  return bridge().disableSchedule(scheduleId);
}

export function listScheduleEvents(filter?: WorkflowScheduleEventFilter) {
  return bridge().listScheduleEvents(filter);
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

export function startRecordingSession(input: RecorderStartSessionInput) {
  return bridge().startRecordingSession(input);
}

export function getRecordingSession(sessionId: string) {
  return bridge().getRecordingSession(sessionId);
}

export function stopRecordingSession(sessionId: string) {
  return bridge().stopRecordingSession(sessionId);
}

export function listRecordingEvents(sessionId: string) {
  return bridge().listRecordingEvents(sessionId);
}

export function discardRecordingSession(sessionId: string) {
  return bridge().discardRecordingSession(sessionId);
}

export function dryRunValidateConfig(config: ActionConfig) {
  return bridge().dryRunValidateConfig(config);
}
