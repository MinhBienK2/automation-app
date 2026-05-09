import {
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
  workflowCommandCallMock,
} from "./electron";

export const invokeMock = workflowCommandCallMock;

export function resetTauriInvoke() {
  resetWorkflowBridge();
}

export function mockTauriCommands(
  commands: Record<string, ((args: unknown) => unknown | Promise<unknown>) | unknown>,
) {
  mockWorkflowBridgeCommands(commands);
}
