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
    throw new Error(`Unexpected command: ${command}`);
  }

  const handler = commands[command];
  return typeof handler === "function"
    ? (handler as CommandHandler)(args)
    : handler;
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
  workflowBridgeMock.dryRunValidateConfig.mockImplementation((config: unknown) =>
    resolveCommand(commands, "dry_run_validate_config", { config }),
  );
  workflowBridgeMock.saveWorkflowPackageFile.mockImplementation((packageValue: unknown) =>
    resolveCommand(commands, "save_workflow_package_file", {
      package: packageValue,
    }),
  );
}
