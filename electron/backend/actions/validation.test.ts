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

  test("validates regex extraction and text file action configs", () => {
    expect(
      validateActionConfig({
        type: "extract_regex_matches",
        config: {
          source_name: "comment_text",
          pattern: "@[A-Za-z0-9._-]+",
          flags: "gi",
          output_name: "handles",
          append: true,
          dedupe: true,
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "extract_regex_matches",
        config: {
          source_name: "",
          pattern: "@[A-Za-z0-9._-]+",
          output_name: "handles",
        },
      } as never),
    ).toEqual({
      field: "source_name",
      message: "Source output is required",
    });

    expect(
      validateActionConfig({
        type: "write_text_file",
        config: {
          source_name: "handles",
          path: "tiktok-usernames.txt",
          output_name: "tiktok_username_file",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "write_text_file",
        config: {
          source_name: "handles",
          path: "../outside.txt",
          output_name: "file",
        },
      } as never),
    ).toEqual({
      field: "path",
      message: "Text file path must be a safe artifact name",
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

  test("accepts Find Element refs for Custom Select triggers", () => {
    expect(
      validateActionConfig({
        type: "select_custom_option",
        config: { trigger_ref: "current_dropdown", option_text: "HD" },
      } as ActionConfig),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "select_custom_option",
        config: { trigger_ref: "", option_text: "HD" },
      } as ActionConfig),
    ).toEqual({
      field: "trigger_ref",
      message: "Trigger ref is required",
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

  test("validates Drag and Drop destination positioning", () => {
    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_target: { locators: [{ kind: "test_id", value: "volume-thumb" }] },
          target_target: { locators: [{ kind: "test_id", value: "volume-track" }] },
          target_position: { mode: "percent", x_percent: 82, y_percent: 50 },
        },
      } as ActionConfig),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_target: { locators: [{ kind: "test_id", value: "volume-thumb" }] },
          target_target: { locators: [{ kind: "test_id", value: "volume-track" }] },
          target_position: { mode: "percent", x_percent: 125, y_percent: 50 },
        },
      } as ActionConfig),
    ).toEqual({
      field: "target_position.x_percent",
      message: "Target X percent must be between 0 and 100",
    });

    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_target: { locators: [{ kind: "test_id", value: "volume-thumb" }] },
          target_target: { locators: [{ kind: "test_id", value: "volume-track" }] },
          target_position: { mode: "offset", x_px: Number.NaN, y_px: 8 },
        },
      } as ActionConfig),
    ).toEqual({
      field: "target_position.x_px",
      message: "Target X offset must be a finite number",
    });
  });

  test("accepts Find Element refs for Drag and Drop endpoints", () => {
    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_ref: "current_thumb",
          target_ref: "current_track",
        },
      } as ActionConfig),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_ref: "",
          target_ref: "current_track",
        },
      } as ActionConfig),
    ).toEqual({
      field: "source_ref",
      message: "Source ref is required",
    });

    expect(
      validateActionConfig({
        type: "drag_and_drop",
        config: {
          source_ref: "current_thumb",
          target_ref: "",
        },
      } as ActionConfig),
    ).toEqual({
      field: "target_ref",
      message: "Target ref is required",
    });
  });

  test("validates new update variable action configs", () => {
    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: {
          name: "my_number",
          operation: "increment",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: {
          name: "my_text",
          operation: "append",
          value: "some text",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_flag_variable",
        config: {
          name: "my_flag",
          operation: "toggle",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: {
          name: "my_list",
          operation: "push",
          value: "item",
          value_type: "text",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_object_variable",
        config: {
          name: "my_object",
          operation: "merge",
          value: '{"foo": "bar"}',
        },
      } as never),
    ).toBeNull();

    // update_number_variable
    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "", operation: "increment" },
      } as never),
    ).toEqual({ field: "name", message: "Variable name is required" });

    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "counter", operation: "invalid_op" },
      } as never),
    ).toEqual({ field: "operation", message: "Operation must be increment, decrement, add, subtract, multiply, or divide" });

    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "counter", operation: "add", value: "" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    // update_text_variable
    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: { name: "my_text", operation: "append", value: "" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: { name: "my_text", operation: "replace", value: "new", search_pattern: "" },
      } as never),
    ).toEqual({ field: "search_pattern", message: "Search pattern is required" });

    // update_flag_variable
    expect(
      validateActionConfig({
        type: "update_flag_variable",
        config: { name: "my_flag", operation: "invalid" },
      } as never),
    ).toEqual({ field: "operation", message: "Operation must be toggle, set_true, or set_false" });

    // update_list_variable
    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "push", value: "", value_type: "text" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "push", value: "item", value_type: "invalid" },
      } as never),
    ).toEqual({ field: "value_type", message: "Value type must be text, json, number, or boolean" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "merge", value: "", value_type: "json" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "merge_unique", value: "[]", value_type: "invalid" },
      } as never),
    ).toEqual({ field: "value_type", message: "Value type must be text, json, number, or boolean" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "remove_by_index", index: null },
      } as never),
    ).toEqual({ field: "index", message: "Index is required" });

    // update_object_variable
    expect(
      validateActionConfig({
        type: "update_object_variable",
        config: { name: "my_obj", operation: "merge", value: "{" },
      } as never),
    ).toEqual({ field: "value", message: "JSON variables must be valid JSON" });

    expect(
      validateActionConfig({
        type: "update_object_variable",
        config: { name: "my_obj", operation: "set_key", property_key: "", property_value: "val", property_value_type: "text" },
      } as never),
    ).toEqual({ field: "property_key", message: "Property key is required" });
    // check_conditions
    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "", mode: "visual" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "is_valid", mode: "script", script: "" },
      } as any),
    ).toEqual({ field: "script", message: "JavaScript script is required in script mode" });

    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "is_valid", mode: "visual", rules_group: {} },
      } as any),
    ).toEqual({ field: "rules_group", message: "Invalid visual rules configuration" });

    // calculate_value
    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "", expression: "1 + 1" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "" },
      } as any),
    ).toEqual({ field: "expression", message: "Expression is required" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "1 + 1", evaluation_type: "invalid" as any },
      } as any),
    ).toEqual({ field: "evaluation_type", message: "Evaluation type must be static or dynamic" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "1 + 1", evaluation_type: "dynamic" },
      } as any),
    ).toBeNull();
  });

  test("allows variable templates in numeric fields", () => {
    expect(
      validateActionConfig({
        type: "switch_tab",
        config: { index: "{{tab_index}}" as any },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "wait",
        config: {
          condition: "duration",
          duration_ms: "{{my_wait_time}}" as any,
          timeout_ms: "{{my_timeout}}" as any,
        },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "wait_for_download",
        config: {
          output_name: "file_result",
          timeout_ms: "{{download_timeout}}" as any,
        },
      }),
    ).toBeNull();
  });
});


