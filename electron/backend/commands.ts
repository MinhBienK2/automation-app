import { isCommandError, type CommandError } from "./commandHelpers.js";

export { createWorkflowCommandHandlers } from "./commands/index.js";
export type WorkflowCommandHandlers = ReturnType<typeof import("./commands/index.js").createWorkflowCommandHandlers>;

export { finishRun } from "./runtime/runDbHelpers.js";
export { defaultWorkflowSettings, deriveFingerprintSeedFromIdentityId } from "./services/workflowSettingsService.js";
export type { CommandError } from "./commandHelpers.js";

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}
