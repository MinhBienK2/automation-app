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
  "saveWorkflowSettings",
  "saveWorkflowSettingsSection",
  "validateWorkflowSettings",
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
  "stopRun",
  "getRunState",
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
  workflowBridgeMock.validateWorkflowRun.mockImplementation((workflowId: string) =>
    resolveCommand(commands, "validate_workflow_run", { workflowId }),
  );
  workflowBridgeMock.createWorkflow.mockImplementation((name: string) =>
    resolveCommand(commands, "create_workflow", { name }),
  );
  workflowBridgeMock.renameWorkflow.mockImplementation((id: string, name: string) =>
    resolveCommand(commands, "rename_workflow", { id, name }),
  );
  workflowBridgeMock.deleteWorkflow.mockImplementation((id: string) =>
    resolveCommand(commands, "delete_workflow", { id }),
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
  workflowBridgeMock.stopRun.mockImplementation(() =>
    resolveCommand(commands, "stop_run", undefined),
  );
  workflowBridgeMock.getRunState.mockImplementation(() =>
    resolveCommand(commands, "get_run_state", undefined),
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
