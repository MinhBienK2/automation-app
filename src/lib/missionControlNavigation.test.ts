import { describe, expect, test } from "vitest";
import {
  activeItemFromScreen,
  createStaleTargetDescriptor,
  isInputLikeShortcutTarget,
  missionControlNavItems,
  operationsTargetToMissionTarget,
} from "./missionControlNavigation";

describe("Mission Control navigation helpers", () => {
  test("keeps the sidebar order centralized", () => {
    expect(missionControlNavItems.map((item) => item.label)).toEqual([
      "Overview",
      "Workflows",
      "Runs",
      "Evidence",
      "Schedules",
      "Identities",
      "Settings",
    ]);
  });

  test("maps app screens to active sidebar items", () => {
    expect(activeItemFromScreen("overview")).toBe("overview");
    expect(activeItemFromScreen("list")).toBe("workflows");
    expect(activeItemFromScreen("detail")).toBe("workflows");
    expect(activeItemFromScreen("runs")).toBe("runs");
    expect(activeItemFromScreen("evidence")).toBe("evidence");
    expect(activeItemFromScreen("identities")).toBe("identities");
  });

  test("converts overview navigation targets into Mission Control targets", () => {
    expect(operationsTargetToMissionTarget({ type: "workflow", workflow_id: "wf_1" }))
      .toEqual({ type: "workflow", workflow_id: "wf_1" });
    expect(operationsTargetToMissionTarget({ type: "evidence", evidence_id: "ev_1" }))
      .toEqual({ type: "evidence", evidence_id: "ev_1" });
  });

  test("builds safe stale target descriptors", () => {
    expect(
      createStaleTargetDescriptor(
        { type: "run", run_id: "run_missing" },
        "search",
        "The run is no longer available.",
      ),
    ).toEqual({
      targetType: "run",
      requestedId: "run_missing",
      source: "search",
      message: "The run is no longer available.",
      fallbackActions: ["refresh", "open_list", "open_overview", "clear_target"],
    });
  });

  test("guards command shortcuts inside inputs, dialogs, and popovers", () => {
    const input = document.createElement("input");
    expect(isInputLikeShortcutTarget(input)).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);
    expect(isInputLikeShortcutTarget(button)).toBe(true);
    dialog.remove();

    const pageButton = document.createElement("button");
    expect(isInputLikeShortcutTarget(pageButton)).toBe(false);
  });
});
