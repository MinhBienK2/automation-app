// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
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
