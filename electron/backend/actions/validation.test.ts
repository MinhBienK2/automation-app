// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../src/types/workflow";
import {
  assertActionValidatorCoverage,
  validateActionConfig,
} from "./validation";

describe("backend action validation registry", () => {
  test("validates action configs through registry-owned validators", () => {
    assertActionValidatorCoverage();

    expect(
      validateActionConfig({
        type: "execute_js",
        config: { script: "", output_name: "result" },
      }),
    ).toEqual({
      field: "script",
      message: "Script is required",
    });
  });

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
          condition: { kind: "output_equals", name: "state", value: "ready" },
          then_steps: [{ type: "legacy_action", config: {} }],
          else_steps: [],
        },
      } as ActionConfig),
    ).toEqual({
      field: "then_steps[0].type",
      message: "Unsupported action type: legacy_action",
    });
  });

  test("accepts Find Element refs as element target sources for non-click actions", () => {
    expect(
      validateActionConfig({
        type: "hover",
        config: { target_ref: "current_card" },
      } as ActionConfig),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "extract_text",
        config: { target_ref: "current_card", output_name: "card_text" },
      } as ActionConfig),
    ).toBeNull();
  });
});
