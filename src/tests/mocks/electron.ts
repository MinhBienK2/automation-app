import { vi } from "vitest";
import type { WorkflowElectronBridge } from "../../types/electron";

type CommandHandler = (args: unknown) => unknown | Promise<unknown>;
type CommandMap = Record<string, CommandHandler | unknown>;
type BridgeMethodName = keyof WorkflowElectronBridge;
type BridgeMock = {
  [Key in BridgeMethodName]: ReturnType<typeof vi.fn>;
};

const methodNames: BridgeMethodName[] = [
  "listProjects",
  "createProject",
  "updateProject",
  "duplicateProject",
  "deleteProject",
  "listProjectEnvironments",
  "createProjectEnvironment",
  "updateProjectEnvironment",
  "resetProjectEnvironmentBrowserIdentity",
  "setWorkflowEnvironment",
  "createSubflow",
  "listSubflows",
  "getSubflow",
  "getSubflowGraph",
  "saveSubflowGraph",
  "duplicateSubflow",
  "deleteSubflow",
  "getSubflowUsage",
  "listWorkflows",
  "getWorkflow",
  "getWorkflowBrowserConfig",
  "saveWorkflowBrowserConfig",
  "getWorkflowSettings",
  "resetWorkflowBrowserIdentity",
  "saveWorkflowSettings",
  "saveWorkflowSettingsSection",
  "validateWorkflowSettings",
  "getCloakBrowserDiagnostics",
  "installCloakBrowserBinary",
  "cleanupOrphanedBrowserProfiles",
  "validateWorkflowRun",
  "createWorkflow",
  "renameWorkflow",
  "deleteWorkflow",
  "duplicateWorkflow",
  "getWorkflowGraph",
  "saveWorkflowGraph",
  "validateWorkflowGraph",
  "compileWorkflowGraph",
  "runWorkflow",
  "runWorkflowFromNode",
  "stopRun",
  "getRunState",
  "listRunStates",
  "getOperationsOverview",
  "listEvidenceItems",
  "getEvidenceDetail",
  "getEvidenceScreenshotPreview",
  "revealEvidenceArtifact",
  "exportEvidenceBundle",
  "getIdentityLabOverview",
  "getIdentityLabDetail",
  "closeIdentityRetainedSession",
  "listSchedules",
  "getSchedule",
  "createSchedule",
  "updateSchedule",
  "deleteSchedule",
  "enableSchedule",
  "disableSchedule",
  "listScheduleEvents",
  "validateSchedule",
  "exportWorkflow",
  "importWorkflow",
  "exportWorkflowPackage",
  "previewWorkflowPackage",
  "importWorkflowPackage",
  "runBatchWorkflow",
  "startRecordingSession",
  "getRecordingSession",
  "stopRecordingSession",
  "listRecordingEvents",
  "discardRecordingSession",
  "generateRecordingDraft",
  "getRecordingDraft",
  "saveRecordingDraft",
  "dryRunValidateConfig",
  "saveWorkflowPackageFile",
];

export const workflowBridgeMock = Object.fromEntries(
  methodNames.map((name) => [name, vi.fn()]),
) as BridgeMock;
export const workflowCommandCallMock = vi.fn();

export function resetWorkflowBridge() {
  for (const method of Object.values(workflowBridgeMock)) {
    method.mockReset();
  }
  workflowCommandCallMock.mockReset();

  window.workflowApi = workflowBridgeMock as unknown as WorkflowElectronBridge;
}

function resolveCommand(commands: CommandMap, command: string, args: unknown) {
  workflowCommandCallMock(command, args);

  if (!(command in commands)) {
    if (command === "list_projects") return defaultProjects();
    if (command === "list_project_environments") return defaultProjectEnvironments();
    if (command === "list_subflows") return [];
    if (command === "get_subflow_usage") return [];
    if (command === "get_operations_overview") return defaultOperationsOverview();
    if (command === "list_evidence_items") return defaultEvidencePage();
    if (command === "get_evidence_detail") return null;
    if (command === "get_evidence_screenshot_preview") {
      throw new Error("Unexpected command: get_evidence_screenshot_preview");
    }
    if (command === "reveal_evidence_artifact") return null;
    if (command === "export_evidence_bundle") return null;
    if (command === "get_identity_lab_overview") return defaultIdentityLabOverview();
    if (command === "get_identity_lab_detail") return null;
    if (command === "close_identity_retained_session") return null;
    throw new Error(`Unexpected command: ${command}`);
  }

  const handler = commands[command];
  return typeof handler === "function"
    ? (handler as CommandHandler)(args)
    : handler;
}

function defaultProjects() {
  return [
    {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T00:00:00.000Z",
    },
  ];
}

function defaultProjectEnvironments() {
  return [
    {
      id: "environment-1",
      project_id: "project-1",
      name: "Project saved session",
      description: "",
      is_default: true,
      browser_launch: null,
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T00:00:00.000Z",
    },
  ];
}

function defaultEvidencePage() {
  return {
    generated_at: "2026-05-27T00:00:00.000Z",
    items: [],
    next_cursor: null,
    has_more: false,
    warnings: {
      skipped_artifacts: 0,
      skipped_reports: 0,
      skipped_traces: 0,
      skipped_manifests: 0,
    },
  };
}

function defaultIdentityLabOverview() {
  return {
    generated_at: "2026-05-27T00:00:00.000Z",
    items: [],
    selected: null,
    counts: {
      managed_identities: 0,
      active_retained_sessions: 0,
      identities_with_warnings: 0,
      identities_with_recent_failures: 0,
    },
    data_warnings: [],
  };
}

function defaultOperationsOverview() {
  return {
    generated_at: "2026-05-27T00:00:00.000Z",
    range: {
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    },
    metrics: {
      active_runs: 0,
      succeeded_today: 0,
      attention_today: 0,
      upcoming_schedules: 0,
    },
    live_runs: { items: [], total: 0, has_more: false },
    attention: { items: [], total: 0, has_more: false },
    activity: [],
    recent_evidence: { items: [], total: 0, has_more: false },
    upcoming_schedules: { items: [], total: 0, has_more: false },
    data_warnings: { evidence_items_skipped: 0 },
  };
}

export function mockWorkflowBridgeCommands(commands: CommandMap) {
  resetWorkflowBridge();

  workflowBridgeMock.listWorkflows.mockImplementation(() =>
    resolveCommand(commands, "list_workflows", undefined),
  );
  workflowBridgeMock.getWorkflow.mockImplementation((id: string) =>
    resolveCommand(commands, "get_workflow", { id }),
  );
  workflowBridgeMock.getWorkflowBrowserConfig.mockImplementation(
    (workflowId: string) =>
      resolveCommand(commands, "get_workflow_browser_config", { workflowId }),
  );
  workflowBridgeMock.saveWorkflowBrowserConfig.mockImplementation(
    (workflowId: string, config: unknown) =>
      resolveCommand(commands, "save_workflow_browser_config", {
        workflowId,
        config,
      }),
  );
  workflowBridgeMock.getWorkflowSettings.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "get_workflow_settings", { workflowId }),
  );
  workflowBridgeMock.resetWorkflowBrowserIdentity.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "reset_workflow_browser_identity", { workflowId }),
  );
  workflowBridgeMock.saveWorkflowSettings.mockImplementation(
    (workflowId: string, settings: unknown) =>
      resolveCommand(commands, "save_workflow_settings", { workflowId, settings }),
  );
  workflowBridgeMock.saveWorkflowSettingsSection.mockImplementation(
    (workflowId: string, section: string, sectionValue: unknown) =>
      resolveCommand(commands, "save_workflow_settings_section", {
        workflowId,
        section,
        sectionValue,
      }),
  );
  workflowBridgeMock.validateWorkflowSettings.mockImplementation((settings: unknown) =>
    resolveCommand(commands, "validate_workflow_settings", { settings }),
  );
  workflowBridgeMock.getCloakBrowserDiagnostics.mockImplementation(() =>
    resolveCommand(commands, "get_cloakbrowser_diagnostics", undefined),
  );
  workflowBridgeMock.installCloakBrowserBinary.mockImplementation(() =>
    resolveCommand(commands, "install_cloakbrowser_binary", undefined),
  );
  workflowBridgeMock.cleanupOrphanedBrowserProfiles.mockImplementation(() =>
    resolveCommand(commands, "cleanup_orphaned_browser_profiles", undefined),
  );
  workflowBridgeMock.validateWorkflowRun.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "validate_workflow_run", { workflowId }),
  );
  workflowBridgeMock.listProjects.mockImplementation(() =>
    resolveCommand(commands, "list_projects", undefined),
  );
  workflowBridgeMock.createProject.mockImplementation((input: unknown) =>
    resolveCommand(commands, "create_project", { input }),
  );
  workflowBridgeMock.updateProject.mockImplementation(
    (projectId: string, input: unknown) =>
      resolveCommand(commands, "update_project", { projectId, input }),
  );
  workflowBridgeMock.duplicateProject.mockImplementation((projectId: string) =>
    resolveCommand(commands, "duplicate_project", { projectId }),
  );
  workflowBridgeMock.deleteProject.mockImplementation((projectId: string) =>
    resolveCommand(commands, "delete_project", { projectId }),
  );
  workflowBridgeMock.listProjectEnvironments.mockImplementation((projectId: string) =>
    resolveCommand(commands, "list_project_environments", { projectId }),
  );
  workflowBridgeMock.createProjectEnvironment.mockImplementation(
    (projectId: string, input: unknown) =>
      resolveCommand(commands, "create_project_environment", { projectId, input }),
  );
  workflowBridgeMock.updateProjectEnvironment.mockImplementation(
    (environmentId: string, input: unknown) =>
      resolveCommand(commands, "update_project_environment", { environmentId, input }),
  );
  workflowBridgeMock.resetProjectEnvironmentBrowserIdentity.mockImplementation(
    (environmentId: string) =>
      resolveCommand(commands, "reset_project_environment_browser_identity", {
        environmentId,
      }),
  );
  workflowBridgeMock.setWorkflowEnvironment.mockImplementation(
    (workflowId: string, environmentId: string) =>
      resolveCommand(commands, "set_workflow_environment", { workflowId, environmentId }),
  );
  workflowBridgeMock.createSubflow.mockImplementation((projectId: string, input: unknown) =>
    resolveCommand(commands, "create_subflow", { projectId, input }),
  );
  workflowBridgeMock.listSubflows.mockImplementation((projectId: string) =>
    resolveCommand(commands, "list_subflows", { projectId }),
  );
  workflowBridgeMock.getSubflow.mockImplementation((subflowId: string) =>
    resolveCommand(commands, "get_subflow", { subflowId }),
  );
  workflowBridgeMock.getSubflowGraph.mockImplementation((subflowId: string) =>
    resolveCommand(commands, "get_subflow_graph", { subflowId }),
  );
  workflowBridgeMock.saveSubflowGraph.mockImplementation((subflowId: string, graph: unknown) =>
    resolveCommand(commands, "save_subflow_graph", { subflowId, graph }),
  );
  workflowBridgeMock.duplicateSubflow.mockImplementation((subflowId: string, name: string) =>
    resolveCommand(commands, "duplicate_subflow", { subflowId, name }),
  );
  workflowBridgeMock.deleteSubflow.mockImplementation((subflowId: string) =>
    resolveCommand(commands, "delete_subflow", { subflowId }),
  );
  workflowBridgeMock.getSubflowUsage.mockImplementation((subflowId: string) =>
    resolveCommand(commands, "get_subflow_usage", { subflowId }),
  );
  workflowBridgeMock.createWorkflow.mockImplementation((name: string, options: unknown) =>
    resolveCommand(commands, "create_workflow", { name, options }),
  );
  workflowBridgeMock.renameWorkflow.mockImplementation((id: string, name: string) =>
    resolveCommand(commands, "rename_workflow", { id, name }),
  );
  workflowBridgeMock.deleteWorkflow.mockImplementation((id: string, options: unknown) =>
    resolveCommand(commands, "delete_workflow", { id, options }),
  );
  workflowBridgeMock.duplicateWorkflow.mockImplementation(
    (workflowId: string, name: string) =>
      resolveCommand(commands, "duplicate_workflow", { workflowId, name }),
  );
  workflowBridgeMock.getWorkflowGraph.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "get_workflow_graph", { workflowId }),
  );
  workflowBridgeMock.saveWorkflowGraph.mockImplementation(
    (workflowId: string, graph: unknown) =>
      resolveCommand(commands, "save_workflow_graph", { workflowId, graph }),
  );
  workflowBridgeMock.validateWorkflowGraph.mockImplementation((graph: unknown) =>
    resolveCommand(commands, "validate_workflow_graph", { graph }),
  );
  workflowBridgeMock.compileWorkflowGraph.mockImplementation((graph: unknown) =>
    resolveCommand(commands, "compile_workflow_graph", { graph }),
  );
  workflowBridgeMock.runWorkflow.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "run_workflow", { workflowId }),
  );
  workflowBridgeMock.runWorkflowFromNode.mockImplementation(
    (workflowId: string, startNodeId: string) =>
      resolveCommand(commands, "run_workflow_from_node", { workflowId, startNodeId }),
  );
  workflowBridgeMock.stopRun.mockImplementation((runId?: string | null) =>
    resolveCommand(commands, "stop_run", { runId }),
  );
  workflowBridgeMock.getRunState.mockImplementation(() =>
    resolveCommand(commands, "get_run_state", undefined),
  );
  workflowBridgeMock.listRunStates.mockImplementation(() =>
    resolveCommand(commands, "list_run_states", undefined),
  );
  workflowBridgeMock.getOperationsOverview.mockImplementation((request: unknown) =>
    resolveCommand(commands, "get_operations_overview", { request }),
  );
  workflowBridgeMock.listEvidenceItems.mockImplementation((request: unknown) =>
    resolveCommand(commands, "list_evidence_items", { request }),
  );
  workflowBridgeMock.getEvidenceDetail.mockImplementation((evidenceId: string) =>
    resolveCommand(commands, "get_evidence_detail", { evidenceId }),
  );
  workflowBridgeMock.getEvidenceScreenshotPreview.mockImplementation((evidenceId: string) =>
    resolveCommand(commands, "get_evidence_screenshot_preview", { evidenceId }),
  );
  workflowBridgeMock.revealEvidenceArtifact.mockImplementation((evidenceId: string) =>
    resolveCommand(commands, "reveal_evidence_artifact", { evidenceId }),
  );
  workflowBridgeMock.exportEvidenceBundle.mockImplementation((request: unknown) =>
    resolveCommand(commands, "export_evidence_bundle", { request }),
  );
  workflowBridgeMock.getIdentityLabOverview.mockImplementation((request: unknown) =>
    resolveCommand(commands, "get_identity_lab_overview", { request }),
  );
  workflowBridgeMock.getIdentityLabDetail.mockImplementation((target: unknown) =>
    resolveCommand(commands, "get_identity_lab_detail", { target }),
  );
  workflowBridgeMock.closeIdentityRetainedSession.mockImplementation(
    (workflowId: string, profileName: string) =>
      resolveCommand(commands, "close_identity_retained_session", {
        workflowId,
        profileName,
      }),
  );
  workflowBridgeMock.listSchedules.mockImplementation(() =>
    resolveCommand(commands, "list_schedules", undefined),
  );
  workflowBridgeMock.getSchedule.mockImplementation((scheduleId: string) =>
    resolveCommand(commands, "get_schedule", { scheduleId }),
  );
  workflowBridgeMock.createSchedule.mockImplementation((input: unknown) =>
    resolveCommand(commands, "create_schedule", { input }),
  );
  workflowBridgeMock.updateSchedule.mockImplementation(
    (scheduleId: string, patch: unknown) =>
      resolveCommand(commands, "update_schedule", { scheduleId, patch }),
  );
  workflowBridgeMock.deleteSchedule.mockImplementation((scheduleId: string) =>
    resolveCommand(commands, "delete_schedule", { scheduleId }),
  );
  workflowBridgeMock.enableSchedule.mockImplementation((scheduleId: string) =>
    resolveCommand(commands, "enable_schedule", { scheduleId }),
  );
  workflowBridgeMock.disableSchedule.mockImplementation((scheduleId: string) =>
    resolveCommand(commands, "disable_schedule", { scheduleId }),
  );
  workflowBridgeMock.listScheduleEvents.mockImplementation((filter: unknown) =>
    resolveCommand(commands, "list_schedule_events", { filter }),
  );
  workflowBridgeMock.validateSchedule.mockImplementation((schedule: unknown) =>
    resolveCommand(commands, "validate_schedule", { schedule }),
  );
  workflowBridgeMock.exportWorkflow.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "export_workflow", { workflowId }),
  );
  workflowBridgeMock.importWorkflow.mockImplementation((exported: unknown) =>
    resolveCommand(commands, "import_workflow", { exported }),
  );
  workflowBridgeMock.exportWorkflowPackage.mockImplementation(
    (workflowId: string, options: unknown) =>
      resolveCommand(commands, "export_workflow_package", {
        workflowId,
        options,
      }),
  );
  workflowBridgeMock.previewWorkflowPackage.mockImplementation((packageValue: unknown) =>
    resolveCommand(commands, "preview_workflow_package", {
      package: packageValue,
    }),
  );
  workflowBridgeMock.importWorkflowPackage.mockImplementation(
    (packageValue: unknown, options: unknown) =>
      resolveCommand(commands, "import_workflow_package", {
        package: packageValue,
        options,
      }),
  );
  workflowBridgeMock.runBatchWorkflow.mockImplementation(
    (workflowId: string, request: unknown) =>
      resolveCommand(commands, "run_batch_workflow", { workflowId, request }),
  );
  workflowBridgeMock.startRecordingSession.mockImplementation((input: unknown) =>
    resolveCommand(commands, "start_recording_session", { input }),
  );
  workflowBridgeMock.getRecordingSession.mockImplementation((sessionId: string) =>
    resolveCommand(commands, "get_recording_session", { sessionId }),
  );
  workflowBridgeMock.stopRecordingSession.mockImplementation((sessionId: string) =>
    resolveCommand(commands, "stop_recording_session", { sessionId }),
  );
  workflowBridgeMock.listRecordingEvents.mockImplementation((sessionId: string) =>
    resolveCommand(commands, "list_recording_events", { sessionId }),
  );
  workflowBridgeMock.discardRecordingSession.mockImplementation((sessionId: string) =>
    resolveCommand(commands, "discard_recording_session", { sessionId }),
  );
  workflowBridgeMock.generateRecordingDraft.mockImplementation(
    (sessionId: string, options: unknown) =>
      resolveCommand(commands, "generate_recording_draft", { sessionId, options }),
  );
  workflowBridgeMock.getRecordingDraft.mockImplementation((draftId: string) =>
    resolveCommand(commands, "get_recording_draft", { draftId }),
  );
  workflowBridgeMock.saveRecordingDraft.mockImplementation(
    (draftId: string, input: unknown) =>
      resolveCommand(commands, "save_recording_draft", { draftId, input }),
  );
  workflowBridgeMock.dryRunValidateConfig.mockImplementation((config: unknown) =>
    resolveCommand(commands, "dry_run_validate_config", { config }),
  );
  workflowBridgeMock.saveWorkflowPackageFile.mockImplementation((packageValue: unknown) =>
    resolveCommand(commands, "save_workflow_package_file", {
      package: packageValue,
    }),
  );
}
