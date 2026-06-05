import { describe, expect, test } from "vitest";
import type { ActionType } from "../types/workflow";
import { actionGroups, actionOptions, allActionOptions } from "./workflowUi";

describe("workflow UI action taxonomy", () => {
  const removedActions = [
    "open_url",
    "sleep",
    "type_text",
    "set_checkbox",
    "switch_frame",
    "set_download_directory",
    "use_profile",
    "save_session",
    "load_session",
    "set_secret",
    "use_proxy",
    "set_user_agent",
    "detect_challenge",
    "pause_for_human",
    "fallback_selector",
    "retry_step",
    "checkpoint",
    "resume_when_condition",
    "run_subworkflow",
  ] as const;

  test("does not expose removed actions", () => {
    for (const actionType of removedActions) {
      expect(actionOptions).not.toContain(actionType as ActionType);
      expect(allActionOptions).not.toContain(actionType as ActionType);
    }
    expect(actionGroups.map((group) => group.label)).not.toContain("Removed");
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
        "find_element",
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

  test("keeps graph-internal action types out of the visible action picker", () => {
    [
      "if_condition",
      "repeat_times",
      "repeat_for_each",
      "retry_block",
      "stop_workflow",
    ].forEach((actionType) => {
      expect(actionOptions).not.toContain(actionType as ActionType);
      expect(allActionOptions).toContain(actionType as ActionType);
    });
  });
});
