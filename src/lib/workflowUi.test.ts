import { describe, expect, test } from "vitest";
import type { ActionType } from "../types/workflow";
import { actionGroups, actionOptions, allActionOptions, buildRunIssues } from "./workflowUi";

describe("workflow UI action taxonomy", () => {
  const removedActions = [
    "open_url",
    "sleep",
    "type_text",
    "set_checkbox",
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
      "File Operations",
      "Integrations",
      "Advanced Utilities",
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

  test("buildRunIssues includes parent step hierarchy in diagnostics if parent_step_ids is provided", () => {
    const runState: any = {
      status: "failed",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: "failed-child",
      current_step_number: 2,
      completed_step_ids: [],
      error: {
        step_id: "failed-child",
        step_number: 2,
        step_name: "Failed Child",
        action_type: "click",
        reason: "Element not found",
        diagnostics: {
          compiled_step_id: "failed-child",
          parent_step_id: "inner-repeat",
          parent_step_ids: ["outer-repeat", "inner-repeat"],
        },
      },
    };
    const issues = buildRunIssues({
      appError: "",
      graphIssues: [],
      runState,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].diagnostics).toContain("Parent step hierarchy: outer-repeat > inner-repeat");
    expect(issues[0].diagnostics).not.toContain("Parent step id: inner-repeat");
  });
});
