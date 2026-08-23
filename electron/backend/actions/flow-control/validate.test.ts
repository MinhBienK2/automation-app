// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
  test("keeps unknown action rejection at the registry gate", () => {
    expect(
      validateActionConfig({ type: "legacy_action", config: {} } as ActionConfig),
    ).toEqual({
      field: "type",
      message: "Unsupported action type: legacy_action",
    });
  });
  test("validates nested action configs recursively", () => {
    expect(
      validateActionConfig({
        type: "if_condition",
        config: {
          condition: { kind: "variable_is_true", name: "state" },
          then_steps: [{ type: "legacy_action", config: {} }],
          else_steps: [],
        },
      } as ActionConfig),
    ).toEqual({
      field: "then_steps[0].type",
      message: "Unsupported action type: legacy_action",
    });
  });
  test("accepts Find Element refs for element-visible logic conditions", () => {
    expect(
      validateActionConfig({
        type: "if_condition",
        config: {
          condition: { kind: "element_visible", target_ref: "current_panel" },
          then_steps: [],
          else_steps: [],
        },
      } as ActionConfig),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "if_condition",
        config: {
          condition: { kind: "element_visible", target_ref: "" },
          then_steps: [],
          else_steps: [],
        },
      } as ActionConfig),
    ).toEqual({
      field: "condition.target_ref",
      message: "Target ref is required",
    });
  });
});
