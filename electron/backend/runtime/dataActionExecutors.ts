/**
 * Data and surface-independent action executors.
 * Composed from modular domain drawers under runtime/executors/ and runtime/control/.
 */

import type { ActionExecutorMap } from "../actions/execution.js";
import { surfaceIndependentActionTypes } from "../../../src/features/workflows/data/actionCapabilities.js";
import type { DataActionDependencies, VariableScope } from "./actionRuntime.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./executors/types.js";
import { buildVariableNumberExecutors } from "./executors/variableNumber.js";
import { buildVariableTextExecutors } from "./executors/variableText.js";
import { buildVariableBooleanExecutors } from "./executors/variableBoolean.js";
import { buildVariableListExecutors } from "./executors/variableList.js";
import { buildVariableObjectExecutors } from "./executors/variableObject.js";
import { buildExtractionExecutors } from "./executors/extraction.js";
import { buildFilesExecutors } from "./executors/files.js";
import { buildNetworkExecutors } from "./executors/network.js";
import { buildKeyboardExecutors } from "./executors/keyboard.js";
import { buildBrowserContextExecutors } from "./executors/browserContext.js";
import { buildVariablesExecutors } from "./control/variables.js";
import { buildFlowControlExecutors } from "./control/flowControl.js";

export function createDataActionExecutors<Runtime extends VariableScope>(
  runtime: Runtime,
  deps: DataActionDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  // Data actions only access VariableScope fields; cast across interface boundary to modular builders
  const scopedRuntime = runtime as unknown as RunnerActionRuntime;
  const scopedDeps = deps as unknown as RunnerActionExecutorDependencies;

  const flowControl = buildFlowControlExecutors(scopedRuntime, scopedDeps);
  const raw: Partial<ActionExecutorMap> = {
    ...flowControl,
    ...buildVariablesExecutors(scopedRuntime),
    ...buildVariableNumberExecutors(scopedRuntime, scopedDeps),
    ...buildVariableTextExecutors(scopedRuntime, scopedDeps),
    ...buildVariableBooleanExecutors(scopedRuntime, scopedDeps),
    ...buildVariableListExecutors(scopedRuntime, scopedDeps),
    ...buildVariableObjectExecutors(scopedRuntime, scopedDeps),
    ...buildExtractionExecutors(scopedRuntime, scopedDeps),
    ...buildFilesExecutors(scopedRuntime, scopedDeps),
    ...buildNetworkExecutors(scopedRuntime, scopedDeps),
    ...buildKeyboardExecutors(scopedRuntime, scopedDeps),
    ...buildBrowserContextExecutors(scopedRuntime, scopedDeps),
  };

  const filtered: Partial<ActionExecutorMap> = {};
  for (const [key, executor] of Object.entries(raw)) {
    if (surfaceIndependentActionTypes.has(key as never) || key in flowControl) {
      (filtered as Record<string, unknown>)[key] = executor;
    }
  }

  return filtered;
}
