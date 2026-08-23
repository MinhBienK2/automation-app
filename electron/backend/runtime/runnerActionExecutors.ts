import {
  createActionExecutorMap,
  assertActionExecutorCoverage,
  type ActionExecutorMap,
} from "../actions/execution.js";
import type {
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "./executors/types.js";
import { buildNavigationExecutors } from "./executors/navigation.js";
import { buildBrowserContextExecutors } from "./executors/browserContext.js";
import { buildFormExecutors } from "./executors/form.js";
import { buildElementInteractionExecutors } from "./executors/elementInteraction.js";
import { buildKeyboardExecutors } from "./executors/keyboard.js";
import { buildCapture1Executors } from "./executors/capture1.js";
import { buildCapture2Executors } from "./executors/capture2.js";
import { buildVariablesExecutors } from "./executors/variables.js";
import { buildVariableData1Executors } from "./executors/variableData1.js";
import { buildVariableData2Executors } from "./executors/variableData2.js";
import { buildVariableData3Executors } from "./executors/variableData3.js";
import { buildVariableData4Executors } from "./executors/variableData4.js";
import { buildFlowControlExecutors } from "./executors/flowControl.js";
import { buildNetworkExecutors } from "./executors/network.js";

export type { RunnerActionRuntime, RunnerActionExecutorDependencies } from "./executors/types.js";

/**
 * Composition of the owner-group executor modules. Coverage over every
 * registered action type is asserted here — a missing executor fails at import
 * time instead of surfacing as an undefined call mid-run.
 */
export function createRunnerActionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ActionExecutorMap {
  const executors = {
    ...buildNavigationExecutors(runtime, deps),
    ...buildBrowserContextExecutors(runtime, deps),
    ...buildFormExecutors(runtime, deps),
    ...buildElementInteractionExecutors(runtime, deps),
    ...buildKeyboardExecutors(runtime, deps),
    ...buildCapture1Executors(runtime, deps),
    ...buildCapture2Executors(runtime, deps),
    ...buildVariablesExecutors(runtime, deps),
    ...buildVariableData1Executors(runtime, deps),
    ...buildVariableData2Executors(runtime, deps),
    ...buildVariableData3Executors(runtime, deps),
    ...buildVariableData4Executors(runtime, deps),
    ...buildFlowControlExecutors(runtime, deps),
    ...buildNetworkExecutors(runtime, deps),
  } satisfies Partial<ActionExecutorMap>;
  assertActionExecutorCoverage(executors);
  return createActionExecutorMap(executors);
}
