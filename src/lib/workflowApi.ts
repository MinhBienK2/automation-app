import type {
  ActionConfig,
  BatchRunRequest,
  OrchestrationSchedule,
  RecordingGenerateDraftOptions,
  RecordingSaveDraftInput,
  RecorderStartSessionInput,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  OperationsOverviewRequest,
  ProjectPackage,
  BrowserProfileInput,
  WorkflowBrowserConfig,
  WorkflowCreateOptions,
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
  SubflowExport,
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

export function listProjects() {
  return bridge().listProjects();
}

export function createProject(input: { name: string; description?: string | null }) {
  return bridge().createProject(input);
}

export function updateProject(
  projectId: string,
  input: { name?: string; description?: string | null },
) {
  return bridge().updateProject(projectId, input);
}

export function duplicateProject(projectId: string) {
  return bridge().duplicateProject(projectId);
}

export function exportProjectPackage(projectId: string) {
  return bridge().exportProjectPackage(projectId);
}

export function previewProjectPackage(packageValue: ProjectPackage) {
  return bridge().previewProjectPackage(packageValue);
}

export function importProjectPackage(packageValue: ProjectPackage) {
  return bridge().importProjectPackage(packageValue);
}

export function deleteProject(projectId: string) {
  return bridge().deleteProject(projectId);
}

export function listBrowserProfiles(projectId: string) {
  return bridge().listBrowserProfiles(projectId);
}

export function createBrowserProfile(
  projectId: string,
  input: BrowserProfileInput,
) {
  return bridge().createBrowserProfile(projectId, input);
}

export function updateBrowserProfile(
  profileId: string,
  input: Partial<BrowserProfileInput>,
) {
  return bridge().updateBrowserProfile(profileId, input);
}

export function deleteBrowserProfile(profileId: string) {
  return bridge().deleteBrowserProfile(profileId);
}

export function setWorkflowBrowserProfile(
  workflowId: string,
  profileId: string,
) {
  return bridge().setWorkflowBrowserProfile(workflowId, profileId);
}

export function resetBrowserProfileIdentity(profileId: string) {
  return bridge().resetBrowserProfileIdentity(profileId);
}

export function createSubflow(
  projectId: string,
  input: { name: string; description?: string | null },
) {
  return bridge().createSubflow(projectId, input);
}

export function listSubflows(projectId: string) {
  return bridge().listSubflows(projectId);
}

export function getSubflow(subflowId: string) {
  return bridge().getSubflow(subflowId);
}

export function updateSubflow(
  subflowId: string,
  input: { name?: string; description?: string | null },
) {
  return bridge().updateSubflow(subflowId, input);
}

export function getSubflowGraph(subflowId: string) {
  return bridge().getSubflowGraph(subflowId);
}

export function saveSubflowGraph(subflowId: string, graph: WorkflowGraph, options?: { comment?: string; tag?: string }) {
  return bridge().saveSubflowGraph(subflowId, graph, options);
}

export function duplicateSubflow(subflowId: string, name: string) {
  return bridge().duplicateSubflow(subflowId, name);
}

export function deleteSubflow(subflowId: string) {
  return bridge().deleteSubflow(subflowId);
}

export function getSubflowUsage(subflowId: string) {
  return bridge().getSubflowUsage(subflowId);
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

export function createWorkflow(name: string, options?: WorkflowCreateOptions) {
  return bridge().createWorkflow(name, options);
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

export function saveWorkflowGraph(workflowId: string, graph: WorkflowGraph, options?: { comment?: string; tag?: string }) {
  return bridge().saveWorkflowGraph(workflowId, graph, options);
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

export function runWorkflowFromNode(
  workflowId: string,
  startNodeId: string,
  mode?: "selected_only" | "from_selected",
) {
  return bridge().runWorkflowFromNode(workflowId, startNodeId, mode);
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

export function getOperationsOverview(request: OperationsOverviewRequest) {
  return bridge().getOperationsOverview(request);
}



export function getIdentityLabOverview(request: IdentityLabOverviewRequest = {}) {
  return bridge().getIdentityLabOverview(request);
}

export function getIdentityLabDetail(target: IdentityLabTarget) {
  return bridge().getIdentityLabDetail(target);
}

export function closeIdentityRetainedSession(workflowId: string, profileName: string) {
  return bridge().closeIdentityRetainedSession(workflowId, profileName);
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

export function saveProjectPackageFile(packageValue: ProjectPackage) {
  return bridge().saveProjectPackageFile(packageValue);
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

export function generateRecordingDraft(
  sessionId: string,
  options: RecordingGenerateDraftOptions,
) {
  return bridge().generateRecordingDraft(sessionId, options);
}

export function getRecordingDraft(draftId: string) {
  return bridge().getRecordingDraft(draftId);
}

export function saveRecordingDraft(
  draftId: string,
  input: RecordingSaveDraftInput,
) {
  return bridge().saveRecordingDraft(draftId, input);
}

export function dryRunValidateConfig(config: ActionConfig) {
  return bridge().dryRunValidateConfig(config);
}

export function exportSubflow(subflowId: string) {
  return bridge().exportSubflow(subflowId);
}

export function importSubflow(projectId: string, exported: SubflowExport) {
  return bridge().importSubflow(projectId, exported);
}

export function saveSubflowPackageFile(packageValue: SubflowExport) {
  return bridge().saveSubflowPackageFile(packageValue);
}

export function listWorkflowRevisions(
  workflowId: string,
  options?: { limit?: number; offset?: number; onlyBackups?: boolean },
) {
  return bridge().listWorkflowRevisions(workflowId, options);
}

export function getWorkflowRevision(revisionId: string) {
  return bridge().getWorkflowRevision(revisionId);
}

export function restoreWorkflowRevision(
  workflowId: string,
  revisionId: string,
  options?: { comment?: string },
) {
  return bridge().restoreWorkflowRevision(workflowId, revisionId, options);
}

export function tagWorkflowRevision(revisionId: string, tag: string) {
  return bridge().tagWorkflowRevision(revisionId, tag);
}

export function untagWorkflowRevision(revisionId: string) {
  return bridge().untagWorkflowRevision(revisionId);
}

export function deleteWorkflowRevision(revisionId: string) {
  return bridge().deleteWorkflowRevision(revisionId);
}

export function listSubflowRevisions(
  subflowId: string,
  options?: { limit?: number; offset?: number; onlyBackups?: boolean },
) {
  return bridge().listSubflowRevisions(subflowId, options);
}

export function getSubflowRevision(revisionId: string) {
  return bridge().getSubflowRevision(revisionId);
}

export function restoreSubflowRevision(
  subflowId: string,
  revisionId: string,
  options?: { comment?: string },
) {
  return bridge().restoreSubflowRevision(subflowId, revisionId, options);
}

export function tagSubflowRevision(revisionId: string, tag: string) {
  return bridge().tagSubflowRevision(revisionId, tag);
}

export function untagSubflowRevision(revisionId: string) {
  return bridge().untagSubflowRevision(revisionId);
}

export function deleteSubflowRevision(revisionId: string) {
  return bridge().deleteSubflowRevision(revisionId);
}

// Auth & Mode Config
export function login(input: { email: string; password: string }) {
  return bridge().login(input);
}

export function logout() {
  return bridge().logout();
}

export function me(input: { token: string }) {
  return bridge().me(input);
}

export function listUsers() {
  return bridge().listUsers();
}

export function createUser(input: { email: string; password: string; role: "admin" | "user" }) {
  return bridge().createUser(input);
}

export function deleteUser(input: { id: string }) {
  return bridge().deleteUser(input);
}

export function getAppConfig() {
  return bridge().getAppConfig();
}

export function saveAppConfig(config: { mode: "public"; publicDatabaseUrl?: string }) {
  return bridge().saveAppConfig(config);
}

