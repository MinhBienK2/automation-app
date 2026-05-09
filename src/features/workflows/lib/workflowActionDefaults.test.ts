import { describe, expect, test } from "vitest";
import { defaultActionConfig } from "./workflowActionDefaults";

describe("workflow action defaults", () => {
  test("element actions initialize structured targets beside legacy xpath", () => {
    expect(defaultActionConfig("click")).toMatchObject({
      type: "click",
      config: { xpath: "", target: null },
    });
    expect(defaultActionConfig("drag_and_drop")).toMatchObject({
      type: "drag_and_drop",
      config: { source_xpath: "", source_target: null, target_xpath: "", target_target: null },
    });
    expect(defaultActionConfig("switch_frame")).toEqual({
      type: "switch_frame",
      config: { xpath: null, target: null },
    });
  });
});
