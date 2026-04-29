import { describe, expect, test } from "vitest";
import type { ActionType } from "../types/workflow";
import { actionGroups, actionOptions } from "./workflowUi";

describe("workflow UI action taxonomy", () => {
  test("does not expose removed legacy actions", () => {
    expect(actionOptions).not.toContain("open_url" as ActionType);
    expect(actionOptions).not.toContain("sleep" as ActionType);
    expect(actionOptions).not.toContain("type_text" as ActionType);
    expect(actionGroups.map((group) => group.label)).not.toContain("Legacy");
  });

  test("groups click and scroll with real user pointer interactions", () => {
    const pointerGroup = actionGroups.find((group) => group.label === "Pointer & Scroll");

    expect(pointerGroup?.actions).toEqual([
      "click",
      "scroll",
      "hover",
      "double_click",
      "right_click",
      "drag_and_drop",
    ]);
  });
});
