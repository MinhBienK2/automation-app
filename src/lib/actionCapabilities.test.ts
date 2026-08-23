import { describe, expect, test } from "vitest";
import { actionCapabilities, isActionVisibleInPrimaryPalette } from "./actionCapabilities";
import { actionLabels, actionOptions, allActionOptions } from "./workflowUi";
import type { ActionType } from "../types/workflow";

describe("action capability registry", () => {
  const removedActions = [
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

  test("classifies every serialized action type", () => {
    const actionTypes = Object.keys(actionLabels) as ActionType[];

    expect(Object.keys(actionCapabilities).sort()).toEqual(actionTypes.sort());
  });

  test("removes old actions from the active action catalog", () => {
    for (const actionType of removedActions) {
      expect(actionCapabilities).not.toHaveProperty(actionType);
      expect(actionLabels).not.toHaveProperty(actionType);
      expect(actionOptions).not.toContain(actionType as ActionType);
      expect(allActionOptions).not.toContain(actionType as ActionType);
    }
  });

  test("does not keep hidden launch-time or planned capability classes", () => {
    expect(new Set(Object.values(actionCapabilities))).toEqual(
      new Set(["implemented", "implemented_partial_requires_validation", "graph_internal"]),
    );
  });

  test("drives primary palette visibility", () => {
    const hiddenFromPrimary: ActionType[] = [
      "domain_allowlist",
      "if_condition",
      "repeat_times",
      "repeat_for_each",
      "retry_block",
      "switch_condition",
      "while_loop",
      "repeat_until",
      "try_catch",
      "fallback_block",
      "break_loop",
      "continue_loop",
      "stop_workflow",
      "transform_variable",
      "assert_output",
    ];

    for (const actionType of hiddenFromPrimary) {
      expect(isActionVisibleInPrimaryPalette(actionType)).toBe(false);
      expect(actionOptions).not.toContain(actionType);
      expect(allActionOptions).toContain(actionType);
    }
  });

  test("keeps primary action options aligned with capability visibility", () => {
    const actionTypes = Object.keys(actionLabels) as ActionType[];

    for (const actionType of actionTypes) {
      const inOptions = (actionOptions as string[]).includes(actionType);
      const visible = isActionVisibleInPrimaryPalette(actionType);
      expect(inOptions, `${actionType}: inOptions=${inOptions} visible=${visible}`).toBe(visible);
    }
  });
});
