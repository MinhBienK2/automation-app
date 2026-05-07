import { describe, expect, test } from "vitest";
import type { ActionType } from "../types/workflow";
import { actionGroups, actionOptions, allActionOptions } from "./workflowUi";

describe("workflow UI action taxonomy", () => {
  test("does not expose removed legacy actions", () => {
    expect(actionOptions).not.toContain("open_url" as ActionType);
    expect(actionOptions).not.toContain("sleep" as ActionType);
    expect(actionOptions).not.toContain("type_text" as ActionType);
    expect(actionGroups.map((group) => group.label)).not.toContain("Legacy");
  });

  test("uses semantic visible action groups without the old Core category", () => {
    expect(actionGroups.map((group) => group.label)).toEqual([
      "Navigation",
      "Element Interaction",
      "Form Fields",
      "Keyboard",
      "Wait",
      "Capture Data",
      "Browser Context",
      "Variables & Checks",
      "Session & Storage",
      "Network",
      "Advanced",
    ]);
    expect(actionGroups.map((group) => group.label)).not.toContain("Core");

    expect(actionGroups.find((group) => group.label === "Wait")?.actions)
      .toEqual(["wait", "random_wait"]);

    expect(actionGroups.find((group) => group.label === "Navigation")?.actions)
      .toEqual([
        "navigate",
        "go_back",
        "go_forward",
        "reload",
        "open_new_tab",
        "switch_tab",
        "close_tab",
      ]);
    expect(actionGroups.find((group) => group.label === "Element Interaction")?.actions)
      .toEqual([
        "click",
        "double_click",
        "right_click",
        "hover",
        "drag_and_drop",
        "focus_element",
        "blur_element",
        "scroll",
      ]);
    expect(actionGroups.find((group) => group.label === "Form Fields")?.actions)
      .toContain("input_text");
    expect(actionGroups.find((group) => group.label === "Form Fields")?.actions)
      .not.toContain("set_checkbox");
  });

  test("keeps hidden action types compatible but out of the visible action picker", () => {
    [
      "set_checkbox",
      "if_condition",
      "repeat_times",
      "repeat_for_each",
      "retry_block",
      "stop_workflow",
      "fallback_selector",
      "retry_step",
      "checkpoint",
      "detect_challenge",
      "pause_for_human",
      "resume_when_condition",
    ].forEach((actionType) => {
      expect(actionOptions).not.toContain(actionType as ActionType);
      expect(allActionOptions).toContain(actionType as ActionType);
    });
  });
});
