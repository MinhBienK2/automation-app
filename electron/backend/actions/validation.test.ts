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
});
