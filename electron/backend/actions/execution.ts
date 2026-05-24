import type { ActionConfig } from "../../../src/types/workflow.js";
import {
  actionDefinitions,
  getActionDefinition,
  unsupportedActionTypeMessage,
  type ActionType,
} from "./registry.js";

export type ActionExecutor<T extends ActionConfig = ActionConfig> = (
  action: T,
) => Promise<void> | void;

export type ActionExecutorMap = {
  [Type in ActionType]: ActionExecutor<Extract<ActionConfig, { type: Type }>>;
};

export function createActionExecutorMap(executors: ActionExecutorMap): ActionExecutorMap {
  return executors;
}

export async function executeRegisteredAction(
  executors: Partial<ActionExecutorMap>,
  action: ActionConfig,
) {
  const definition = getActionDefinition((action as { type?: unknown }).type);
  if (!definition) {
    throw new Error(unsupportedActionTypeMessage((action as { type?: unknown }).type));
  }

  const executor = executors[definition.type] as ActionExecutor<ActionConfig> | undefined;
  if (typeof executor !== "function") {
    throw missingExecutorError(definition.type);
  }

  await executor(action);
}

export function assertActionExecutorCoverage(
  executors: Partial<Record<ActionType, unknown>>,
): asserts executors is ActionExecutorMap {
  for (const definition of actionDefinitions) {
    if (typeof executors[definition.type] !== "function") {
      throw missingExecutorError(definition.type);
    }
  }
}

function missingExecutorError(type: ActionType) {
  return new Error(`Action ${type} is registered without an execution handler`);
}
