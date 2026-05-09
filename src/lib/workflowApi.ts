import { invoke } from "@tauri-apps/api/core";
import type {
  ActionConfig,
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  ElectronRunEvent,
  Environment,
  EnvironmentInput,
  ElementSnapshot,
  GraphValidationIssue,
  IdentityProfile,
  IdentityProfileAvailability,
  IdentityProfileInput,
  IdentityProfileValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunEvidenceArtifact,
  RunEvidenceEvent,
  RunEvidenceExport,
  RunHistoryRecord,
  RunProfile,
  RunProfileInput,
  RunValidationIssue,
  RunState,
  SelectorCandidate,
  SettingsValidationIssue,
  WorkflowBrowserConfig,
  WorkflowDefaults,
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
  WorkspacePolicy,
} from "../types/workflow";

function electronApi() {
  return typeof window !== "undefined" ? window.cloakBrowser : undefined;
}

export function listWorkflows() {
  const api = electronApi();
  if (api?.workflows?.list) return api.workflows.list();
  return invoke<WorkflowSummary[]>("list_workflows");
}

export function getWorkflow(id: string) {
  const api = electronApi();
  if (api?.workflows?.get) return api.workflows.get({ id });
  return invoke<WorkflowDetail | null>("get_workflow", { id });
}

export function getWorkflowBrowserConfig(workflowId: string) {
  const api = electronApi();
  if (api?.settings?.getBrowserConfig) {
    return api.settings.getBrowserConfig({ workflowId });
  }
  return invoke<WorkflowBrowserConfig>("get_workflow_browser_config", { workflowId });
}

export function saveWorkflowBrowserConfig(
  workflowId: string,
  config: WorkflowBrowserConfig,
) {
  const api = electronApi();
  if (api?.settings?.saveBrowserConfig) {
    return api.settings.saveBrowserConfig({ workflowId, config });
  }
  return invoke("save_workflow_browser_config", { workflowId, config });
}

export function getWorkflowSettings(workflowId: string) {
  const api = electronApi();
  if (api?.settings?.get) return api.settings.get({ workflowId });
  return invoke<WorkflowSettings>("get_workflow_settings", { workflowId });
}

export function saveWorkflowSettings(
  workflowId: string,
  settings: WorkflowSettings,
) {
  const api = electronApi();
  if (api?.settings?.save) return api.settings.save({ workflowId, settings });
  return invoke<WorkflowSettings>("save_workflow_settings", { workflowId, settings });
}

export function saveWorkflowSettingsSection<
  Section extends WorkflowSettingsSectionId,
>(
  workflowId: string,
  section: Section,
  sectionValue: WorkflowSettings[Section],
) {
  const api = electronApi();
  if (api?.settings?.saveSection) {
    return api.settings.saveSection({ workflowId, section, sectionValue });
  }
  return invoke<WorkflowSettings>("save_workflow_settings_section", {
    workflowId,
    section,
    sectionValue,
  });
}

export function validateWorkflowSettings(settings: WorkflowSettings) {
  const api = electronApi();
  if (api?.settings?.validate) return api.settings.validate({ settings });
  return invoke<SettingsValidationIssue[]>("validate_workflow_settings", {
    settings,
  });
}

export function validateWorkflowRun(workflowId: string) {
  const api = electronApi();
  if (api?.settings?.validateRun) return api.settings.validateRun({ workflowId });
  return invoke<RunValidationIssue[]>("validate_workflow_run", { workflowId });
}

export function createWorkflow(name: string) {
  const api = electronApi();
  if (api?.workflows?.create) return api.workflows.create({ name });
  return invoke<Workflow>("create_workflow", { name });
}

export function renameWorkflow(id: string, name: string) {
  const api = electronApi();
  if (api?.workflows?.rename) return api.workflows.rename({ id, name });
  return invoke("rename_workflow", { id, name });
}

export function deleteWorkflow(id: string) {
  const api = electronApi();
  if (api?.workflows?.delete) return api.workflows.delete({ id });
  return invoke("delete_workflow", { id });
}

export function duplicateWorkflow(workflowId: string, name: string) {
  const api = electronApi();
  if (api?.workflows?.duplicate) return api.workflows.duplicate({ workflowId, name });
  return invoke<WorkflowDetail>("duplicate_workflow", { workflowId, name });
}

export function getWorkflowDefaults(workflowId: string) {
  const api = electronApi();
  if (api?.workflows?.getDefaults) return api.workflows.getDefaults({ workflowId });
  return invoke<WorkflowDefaults>("get_workflow_defaults", { workflowId });
}

export function updateWorkflowDefaults(
  workflowId: string,
  defaults: Partial<Omit<WorkflowDefaults, "workflowId">>,
) {
  const api = electronApi();
  if (api?.workflows?.updateDefaults) {
    return api.workflows.updateDefaults({ workflowId, defaults });
  }
  return invoke<WorkflowDefaults>("update_workflow_defaults", { workflowId, defaults });
}

export function getWorkflowGraph(workflowId: string) {
  const api = electronApi();
  if (api?.graphs?.loadActive) return api.graphs.loadActive({ workflowId });
  return invoke<WorkflowGraph>("get_workflow_graph", { workflowId });
}

export function saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
  const api = electronApi();
  if (api?.graphs?.save) return api.graphs.save({ workflowId, graph });
  return invoke("save_workflow_graph", { workflowId, graph });
}

export function validateWorkflowGraph(graph: WorkflowGraph) {
  const api = electronApi();
  if (api?.graphs?.validate) return api.graphs.validate({ graph });
  return invoke<GraphValidationIssue[]>("validate_workflow_graph", { graph });
}

export function compileWorkflowGraph(graph: WorkflowGraph) {
  const api = electronApi();
  if (api?.graphs?.compile) return api.graphs.compile({ graph });
  return invoke<CompiledWorkflowGraph>("compile_workflow_graph", { graph });
}

export function runWorkflow(workflowId: string) {
  const api = electronApi();
  if (api?.runs?.start) return api.runs.start({ workflowId });
  return invoke<RunState>("run_workflow", { workflowId });
}

export function listRuns(input: { workflowId?: string; limit?: number } = {}) {
  const api = electronApi();
  if (api?.runs?.list) return api.runs.list(input);
  return invoke<RunHistoryRecord[]>("list_runs", input);
}

export function stopRun() {
  const api = electronApi();
  if (api?.runs?.stop) return api.runs.stop();
  return invoke<RunState>("stop_run");
}

export function getRunState() {
  const api = electronApi();
  if (api?.runs?.getState) return api.runs.getState();
  return invoke<RunState>("get_run_state");
}

export function onRunEvent(handler: (event: ElectronRunEvent) => void) {
  const api = electronApi();
  if (api?.runs?.onEvent) return api.runs.onEvent(handler);
  return () => undefined;
}

export function listIdentityProfiles() {
  const api = electronApi();
  if (api?.profiles?.list) return api.profiles.list();
  return invoke<IdentityProfile[]>("list_identity_profiles");
}

export function getIdentityProfile(id: string) {
  const api = electronApi();
  if (api?.profiles?.get) return api.profiles.get({ id });
  return invoke<IdentityProfile>("get_identity_profile", { id });
}

export function createIdentityProfile(profile: IdentityProfileInput) {
  const api = electronApi();
  if (api?.profiles?.create) return api.profiles.create(profile);
  return invoke<IdentityProfile>("create_identity_profile", { profile });
}

export function updateIdentityProfile(
  id: string,
  profile: Partial<IdentityProfileInput>,
) {
  const api = electronApi();
  if (api?.profiles?.update) return api.profiles.update({ id, profile });
  return invoke<IdentityProfile>("update_identity_profile", { id, profile });
}

export function deleteIdentityProfile(id: string) {
  const api = electronApi();
  if (api?.profiles?.delete) return api.profiles.delete({ id });
  return invoke("delete_identity_profile", { id });
}

export function validateIdentityProfile(profile: IdentityProfile | IdentityProfileInput) {
  const api = electronApi();
  if (api?.profiles?.validate) return api.profiles.validate({ profile });
  return invoke<IdentityProfileValidationIssue[]>("validate_identity_profile", { profile });
}

export function checkIdentityProfileAvailability(id: string) {
  const api = electronApi();
  if (api?.profiles?.checkAvailability) return api.profiles.checkAvailability({ id });
  return invoke<IdentityProfileAvailability>("check_identity_profile_availability", { id });
}

export function getRunEvidenceSummary(runId: string) {
  const api = electronApi();
  if (api?.evidence?.getRunSummary) return api.evidence.getRunSummary({ runId });
  return invoke<RunHistoryRecord>("get_run_evidence_summary", { runId });
}

export function listRunEvidenceEvents(runId: string) {
  const api = electronApi();
  if (api?.evidence?.listEvents) return api.evidence.listEvents({ runId });
  return invoke<RunEvidenceEvent[]>("list_run_evidence_events", { runId });
}

export function listRunEvidenceArtifacts(runId: string) {
  const api = electronApi();
  if (api?.evidence?.listArtifacts) return api.evidence.listArtifacts({ runId });
  return invoke<RunEvidenceArtifact[]>("list_run_evidence_artifacts", { runId });
}

export function exportRunEvidence(runId: string) {
  const api = electronApi();
  if (api?.evidence?.exportRun) return api.evidence.exportRun({ runId });
  return invoke<RunEvidenceExport>("export_run_evidence", { runId });
}

export function sanitizeEvidencePayload(payload: Record<string, unknown>) {
  const api = electronApi();
  if (api?.evidence?.sanitize) return api.evidence.sanitize({ payload });
  return invoke<Record<string, unknown>>("sanitize_evidence_payload", { payload });
}

export function getWorkspacePolicy() {
  const api = electronApi();
  if (api?.policy?.get) return api.policy.get();
  return invoke<WorkspacePolicy>("get_workspace_policy");
}

export function saveWorkspacePolicy(policy: WorkspacePolicy) {
  const api = electronApi();
  if (api?.policy?.save) return api.policy.save(policy);
  return invoke<WorkspacePolicy>("save_workspace_policy", { policy });
}

export function listRunProfiles(input: { workflowId?: string | null } = {}) {
  const api = electronApi();
  if (api?.runProfiles?.list) return api.runProfiles.list(input);
  return invoke<RunProfile[]>("list_run_profiles", input);
}

export function getRunProfile(id: string) {
  const api = electronApi();
  if (api?.runProfiles?.get) return api.runProfiles.get({ id });
  return invoke<RunProfile>("get_run_profile", { id });
}

export function createRunProfile(profile: RunProfileInput) {
  const api = electronApi();
  if (api?.runProfiles?.create) return api.runProfiles.create(profile);
  return invoke<RunProfile>("create_run_profile", { profile });
}

export function updateRunProfile(id: string, profile: Partial<RunProfileInput>) {
  const api = electronApi();
  if (api?.runProfiles?.update) return api.runProfiles.update({ id, profile });
  return invoke<RunProfile>("update_run_profile", { id, profile });
}

export function deleteRunProfile(id: string) {
  const api = electronApi();
  if (api?.runProfiles?.delete) return api.runProfiles.delete({ id });
  return invoke("delete_run_profile", { id });
}

export function listEnvironments() {
  const api = electronApi();
  if (api?.environments?.list) return api.environments.list();
  return invoke<Environment[]>("list_environments");
}

export function getEnvironment(id: string) {
  const api = electronApi();
  if (api?.environments?.get) return api.environments.get({ id });
  return invoke<Environment>("get_environment", { id });
}

export function createEnvironment(environment: EnvironmentInput) {
  const api = electronApi();
  if (api?.environments?.create) return api.environments.create(environment);
  return invoke<Environment>("create_environment", { environment });
}

export function updateEnvironment(id: string, environment: Partial<EnvironmentInput>) {
  const api = electronApi();
  if (api?.environments?.update) return api.environments.update({ id, environment });
  return invoke<Environment>("update_environment", { id, environment });
}

export function deleteEnvironment(id: string) {
  const api = electronApi();
  if (api?.environments?.delete) return api.environments.delete({ id });
  return invoke("delete_environment", { id });
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
