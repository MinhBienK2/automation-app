import { describe, expect, test } from "vitest";
import type { ActionConfig, ActionType } from "./workflow";

const graphInternalExecutableTypes: ActionType[] = [
  "if_condition",
  "repeat_times",
  "repeat_for_each",
  "retry_block",
  "switch_condition",
  "while_loop",
  "repeat_until",
  "try_catch",
  "fallback_block",
  "break_loop",
  "continue_loop",
  "stop_workflow",
  "transform_variable",
  "assert_output",
  "run_subworkflow",
  "domain_allowlist",
];

const graphInternalConfig: ActionConfig = {
  type: "switch_condition",
  config: {
    expression: "status",
    cases: [],
    default_steps: [],
  },
};

describe("workflow serialized action contracts", () => {
  test("ActionType includes graph-internal executable ActionConfig variants", () => {
    expect(graphInternalExecutableTypes).toContain(graphInternalConfig.type);
  });
});
