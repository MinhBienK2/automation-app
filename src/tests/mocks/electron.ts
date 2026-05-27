import { vi } from "vitest";
import type { WorkflowElectronBridge } from "../../types/electron";

type CommandHandler = (args: unknown) => unknown | Promise<unknown>;
type CommandMap = Record<string, CommandHandler | unknown>;
type BridgeMethodName = keyof WorkflowElectronBridge;
type BridgeMock = {
  [Key in BridgeMethodName]: ReturnType<typeof vi.fn>;
};

const methodNames: BridgeMethodName[] = [
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
  "getOperationalRunDetail",
  "listEvidenceItems",
  "getEvidenceDetail",
  "getEvidenceScreenshotPreview",
  "revealEvidenceArtifact",
  "exportEvidenceBundle",
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
  "suggestSelectors",
  "normalizeRecordedEvents",
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
    if (command === "get_operations_overview") return defaultOperationsOverview();
    if (command === "get_operational_run_detail") return null;
    if (command === "list_evidence_items") return defaultEvidencePage();
    if (command === "get_evidence_detail") return null;
    if (command === "get_evidence_screenshot_preview") {
      throw new Error("Unexpected command: get_evidence_screenshot_preview");
    }
    if (command === "reveal_evidence_artifact") return null;
    if (command === "export_evidence_bundle") return null;
    throw new Error(`Unexpected command: ${command}`);
  }

  const handler = commands[command];
  return typeof handler === "function"
    ? (handler as CommandHandler)(args)
    : handler;
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
  workflowBridgeMock.createWorkflow.mockImplementation((name: string) =>
    resolveCommand(commands, "create_workflow", { name }),
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
  workflowBridgeMock.getOperationalRunDetail.mockImplementation((runId: string) =>
    resolveCommand(commands, "get_operational_run_detail", { runId }),
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
  workflowBridgeMock.suggestSelectors.mockImplementation((snapshot: unknown) =>
    resolveCommand(commands, "suggest_selectors", { snapshot }),
  );
  workflowBridgeMock.normalizeRecordedEvents.mockImplementation((events: unknown) =>
    resolveCommand(commands, "normalize_recorded_events", { events }),
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
