import { describe, expect, test } from "vitest";
import { actionOptions } from "../../../lib/workflowUi";
import { defaultActionConfig } from "./workflowActionDefaults";

describe("workflow action defaults", () => {
  const forbiddenPublicFields = [
    "xpath",
    "iframe_xpath",
    "trigger_xpath",
    "source_xpath",
    "target_xpath",
    "wait_until",
    "timeout_ms",
    "typing_mode",
    "delay_ms",
    "mode",
    "retry_interval_ms",
    "post_click_wait_ms",
    "scroll_into_view",
    "block",
    "inline",
    "position",
    "offset_x",
    "offset_y",
    "wait_ms",
    "method",
  ];

  test("visible action defaults use simplified public config fields", () => {
    for (const actionType of actionOptions) {
      expect(Object.keys(defaultActionConfig(actionType).config)).not.toEqual(
        expect.arrayContaining(forbiddenPublicFields),
      );
    }
  });

  test("element actions initialize canonical structured targets", () => {
    expect(defaultActionConfig("click")).toEqual({
      type: "click",
      config: { target: null },
    });
    expect(defaultActionConfig("input_text")).toEqual({
      type: "input_text",
      config: { target: null, text: "", clear_before_input: true },
    });
    expect(defaultActionConfig("clear_input")).toEqual({
      type: "clear_input",
      config: { target: null },
    });
    expect(defaultActionConfig("drag_and_drop")).toEqual({
      type: "drag_and_drop",
      config: { source_target: null, target_target: null },
    });
  });
});
