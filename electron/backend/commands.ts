import { isCommandError, type CommandError } from "./commandHelpers.js";

export { createWorkflowCommandHandlers } from "./features/index.js";
export type WorkflowCommandHandlers = ReturnType<typeof import("./features/index.js").createWorkflowCommandHandlers>;

export type { CommandError } from "./commandHelpers.js";

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}
