import { describe, expect, test } from "vitest";
import {
  actionCapabilities,
  isActionAvailableOnSurface,
  isActionVisibleInPrimaryPalette,
} from "./actionCapabilities";
import { actionPickerGroupsForSurface } from "../features/workflows/components/ActionNodePalette";
import { actionLabels, actionOptions, allActionOptions } from "./workflowUi";
import type { ActionType } from "../types/workflow";
import {
  dataNodeGroups,
  endNodeGroups,
  logicNodeGroups,
  variableNodeGroups,
} from "../features/workflows/components/WorkflowGraphPalettes";

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
    // The guard is against classes that describe an intention — "planned",
    // "coming soon" — not against genuine ones. `desktop_surface` says where an
    // action runs, which is a fact about it today.
    expect(new Set(Object.values(actionCapabilities))).toEqual(
      new Set([
        "implemented",
        "implemented_partial_requires_validation",
        "graph_internal",
        "desktop_surface",
      ]),
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

  test("leaves no implemented action unreachable from any palette", () => {
    // The failure this guards against is silent: an action ships with an
    // executor and a label, is added to no palette, and simply cannot be
    // used. Nothing else fails when that happens.
    const graphPaletteNodes = new Set(
      [...logicNodeGroups, ...variableNodeGroups, ...dataNodeGroups, ...endNodeGroups].flatMap(
        (group) => group.nodes as string[],
      ),
    );

    const unreachable = (Object.keys(actionLabels) as ActionType[]).filter(
      (actionType) =>
        isActionVisibleInPrimaryPalette(actionType) &&
        !actionOptions.includes(actionType) &&
        !graphPaletteNodes.has(actionType),
    );

    expect(unreachable).toEqual([]);
  });
});

describe("surface availability", () => {
  test("a web workflow is never offered a desktop action", () => {
    expect(isActionAvailableOnSurface("desktop_click", "web")).toBe(false);
    expect(isActionAvailableOnSurface("click", "web")).toBe(true);
  });

  test("a desktop workflow is never offered a web action", () => {
    // Offering one would only let an operator build a step that cannot run:
    // a workflow belongs to exactly one surface and cannot mix.
    expect(isActionAvailableOnSurface("click", "desktop")).toBe(false);
    expect(isActionAvailableOnSurface("desktop_click", "desktop")).toBe(true);
  });

  test("control flow belongs to both, which is the whole point of the split", () => {
    // Actions classified `graph_internal` execute above any surface. A few
    // others are surface-independent too — `set_variable`, `http_request`,
    // the date and crypto families — but they read as `implemented`, and
    // separating "implemented on the web" from "implemented anywhere" is a
    // reclassification the desktop palette will need before it ships.
    for (const surface of ["web", "desktop"] as const) {
      expect(isActionAvailableOnSurface("if_condition", surface)).toBe(true);
      expect(isActionAvailableOnSurface("repeat_times", surface)).toBe(true);
      expect(isActionAvailableOnSurface("math_operation", surface)).toBe(true);
    }
  });

  test("every desktop action is reachable from a desktop palette", () => {
    const offered = new Set(
      actionPickerGroupsForSurface("desktop").flatMap((group) => group.actions),
    );
    const desktopActions = (Object.keys(actionCapabilities) as ActionType[]).filter(
      (actionType) => actionCapabilities[actionType] === "desktop_surface",
    );

    expect(desktopActions.filter((actionType) => !offered.has(actionType))).toEqual([]);
  });
});
