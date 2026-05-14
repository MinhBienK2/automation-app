import { describe, expect, test } from "vitest";
import { actionCapabilities, isActionVisibleInPrimaryPalette } from "./actionCapabilities";
import { actionLabels, actionOptions, allActionOptions } from "./workflowUi";
import type { ActionType } from "../types/workflow";

describe("action capability registry", () => {
  test("classifies every serialized action type", () => {
    const actionTypes = Object.keys(actionLabels) as ActionType[];

    expect(Object.keys(actionCapabilities).sort()).toEqual(actionTypes.sort());
  });

  test("drives primary palette visibility", () => {
    const hiddenFromPrimary: ActionType[] = [
      "run_subworkflow",
      "domain_allowlist",
      "checkpoint",
      "detect_challenge",
      "pause_for_human",
      "use_profile",
      "use_proxy",
      "set_user_agent",
      "set_download_directory",
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
      expect(actionOptions.includes(actionType)).toBe(
        isActionVisibleInPrimaryPalette(actionType),
      );
    }
  });
});
