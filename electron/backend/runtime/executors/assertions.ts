import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { assertElementState, assertRuntimeEnumValue } from "../runtimeHelpers.js";

export function buildAssertionsExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
    assert_element: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      await assertElementState(locator, action.config.state, action.config.timeout_ms);
    },
    assert_text: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const text = await (await deps.locatorForAction(runtime, action.config, "body")).textContent?.();
      if (action.config.match_mode === "equals" && text !== action.config.text) {
        throw new Error(`Text did not equal ${action.config.text}`);
      }
      if (action.config.match_mode === "contains" && !String(text ?? "").includes(action.config.text)) {
        throw new Error(`Text did not contain ${action.config.text}`);
      }
    },
  };
}
