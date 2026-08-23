// @vitest-environment node

import { describe, expect, test } from "vitest";
import { resolveDesktopLocator } from "./locator.js";
import { suggestDesktopLocator, toPickerTree } from "./picker.js";
import type { ElementSnapshot, SnapshotElement } from "./types.js";

/**
 * Same fixtures as `locator.test.ts`, deliberately: the picker is that module's
 * algorithm run backwards, and the Notepad tab strip is the case that decides
 * whether the two agree — every tab owns a "Close Tab" button with an identical
 * label, so a picker that stops at the name produces a locator that resolution
 * then refuses as ambiguous.
 */

function snapshot(elements: SnapshotElement[], extra: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return { snapshot_id: "s00000001", elements, element_count: elements.length, ...extra };
}

const NOTEPAD: SnapshotElement[] = [
  { depth: 2, element_index: 0, element_token: "s00000001:0", role: "Document", label: "Text editor", value: "salary review notes" },
  { depth: 4, element_index: 1, element_token: "s00000001:1", role: "List", label: "TabListView" },
  { depth: 5, element_index: 2, element_token: "s00000001:2", role: "TabItem", label: "Bo. Modified.", parent_index: 1 },
  { depth: 6, element_index: 3, element_token: "s00000001:3", role: "Text", label: "Bo", parent_index: 2 },
  { depth: 6, element_index: 4, element_token: "s00000001:4", role: "Button", label: "Close Tab", parent_index: 2 },
  { depth: 5, element_index: 5, element_token: "s00000001:5", role: "TabItem", label: "notes.txt. Unmodified.", parent_index: 1 },
  { depth: 6, element_index: 6, element_token: "s00000001:6", role: "Button", label: "Close Tab", parent_index: 5 },
  { depth: 4, element_index: 7, element_token: "s00000001:7", role: "Button", label: "Add New Tab" },
  { depth: 4, element_index: 8, element_token: "s00000001:8", role: "MenuItem", label: "File" },
];

/** Resolves the suggestion and asserts it comes back to the element it was made for. */
function roundTrips(element: SnapshotElement, tree: SnapshotElement[]): boolean {
  const suggestion = suggestDesktopLocator(element, snapshot(tree));
  const resolution = resolveDesktopLocator(suggestion.locator, snapshot(tree));
  return resolution.ok && resolution.element.element_index === element.element_index;
}

describe("suggestDesktopLocator", () => {
  test("prefers an automation id, and keeps role and name as a fallback", () => {
    const withId: SnapshotElement[] = [
      { depth: 3, element_index: 0, element_token: "s:0", role: "Button", label: "Save", automation_id: "saveButton" },
      { depth: 3, element_index: 1, element_token: "s:1", role: "Button", label: "Save" },
    ];

    const suggestion = suggestDesktopLocator(withId[0], snapshot(withId));

    expect(suggestion.matchedBy).toBe("automation_id");
    // Carried even though the id alone resolves: resolution falls through to
    // role and name when an application drops the id.
    expect(suggestion.locator).toEqual({
      role: "Button",
      name: { kind: "exact", value: "Save" },
      automationId: "saveButton",
    });
    expect(suggestion.fragile).toBe(false);
  });

  test("ignores an automation id that several elements share", () => {
    // Resolution falls through when an id is not unique, so a picker that
    // stopped at it would emit a locator resolution then calls ambiguous.
    const shared: SnapshotElement[] = [
      { depth: 3, element_index: 0, element_token: "s:0", role: "Button", label: "First", automation_id: "row" },
      { depth: 3, element_index: 1, element_token: "s:1", role: "Button", label: "Second", automation_id: "row" },
    ];

    expect(suggestDesktopLocator(shared[0], snapshot(shared)).matchedBy).toBe("name");
    expect(roundTrips(shared[0], shared)).toBe(true);
  });

  test("uses the name alone when it is already unique", () => {
    const suggestion = suggestDesktopLocator(NOTEPAD[7], snapshot(NOTEPAD));

    expect(suggestion.matchedBy).toBe("name");
    expect(suggestion.locator).toEqual({ role: "Button", name: { kind: "exact", value: "Add New Tab" } });
    expect(suggestion.explanation).toContain("only Button");
  });

  test("adds the nearest named ancestor when the name is shared", () => {
    const closeSecondTab = NOTEPAD[6];

    const suggestion = suggestDesktopLocator(closeSecondTab, snapshot(NOTEPAD));

    expect(suggestion.matchedBy).toBe("ancestry");
    expect(suggestion.locator.ancestors).toEqual([
      { role: "TabItem", name: { kind: "exact", value: "notes.txt. Unmodified." } },
    ]);
    expect(suggestion.fragile).toBe(false);
    expect(roundTrips(closeSecondTab, NOTEPAD)).toBe(true);
  });

  test("stops at the first ancestor that disambiguates rather than listing the chain", () => {
    // Every extra ancestor is another thing that can change. TabListView is a
    // true ancestor of both Close Tab buttons and would not narrow anything.
    const suggestion = suggestDesktopLocator(NOTEPAD[4], snapshot(NOTEPAD));

    expect(suggestion.locator.ancestors).toHaveLength(1);
  });

  test("falls back to an ordinal, and says what that costs", () => {
    // Identical siblings under one parent: nothing named separates them.
    const rows: SnapshotElement[] = [
      { depth: 3, element_index: 0, element_token: "s:0", role: "List", label: "Results" },
      { depth: 4, element_index: 1, element_token: "s:1", role: "ListItem", label: "Row", parent_index: 0 },
      { depth: 4, element_index: 2, element_token: "s:2", role: "ListItem", label: "Row", parent_index: 0 },
      { depth: 4, element_index: 3, element_token: "s:3", role: "ListItem", label: "Row", parent_index: 0 },
    ];

    const suggestion = suggestDesktopLocator(rows[2], snapshot(rows));

    expect(suggestion.matchedBy).toBe("ordinal");
    expect(suggestion.locator.ordinal).toBe(1);
    expect(suggestion.fragile).toBe(true);
    expect(suggestion.explanation).toContain("reordered");
    expect(roundTrips(rows[2], rows)).toBe(true);
  });

  test("describes an unnamed element by role, not by an empty name", () => {
    const unnamed: SnapshotElement[] = [
      { depth: 3, element_index: 0, element_token: "s:0", role: "Custom" },
      { depth: 3, element_index: 1, element_token: "s:1", role: "Button", label: "Save" },
    ];

    const suggestion = suggestDesktopLocator(unnamed[0], snapshot(unnamed));

    expect(suggestion.locator).toEqual({ role: "Custom" });
    expect(roundTrips(unnamed[0], unnamed)).toBe(true);
  });

  test("every element of a real tree round-trips", () => {
    // The property the whole module exists for, asserted over the fixture
    // rather than element by element: a picker that disagrees with resolution
    // anywhere is a picker that hands operators broken steps.
    const failures = NOTEPAD.filter((element) => !roundTrips(element, NOTEPAD));

    expect(failures.map((f) => `${f.role} ${f.label ?? ""}`)).toEqual([]);
  });

  test("says so plainly when an element cannot be described at all", () => {
    // A degraded window has no tree to resolve against, so nothing the picker
    // writes can be found again. Better to say that than to hand back a locator
    // that fails on the first run.
    const degraded = snapshot(
      [{ depth: 1, element_index: 0, element_token: "s:0", role: "Pane", label: "Canvas" }],
      { degraded: true, degraded_reason: "ax_tree_empty" },
    );

    const suggestion = suggestDesktopLocator(degraded.elements[0], degraded);

    expect(suggestion.fragile).toBe(true);
    expect(suggestion.explanation).toContain("could not be described");
  });
});

describe("toPickerTree", () => {
  test("drops element values, which is what the tree leaks", () => {
    // A Document's value is the whole open file. The picker needs roles, names
    // and ancestry, and none of those is a value.
    const tree = toPickerTree(snapshot(NOTEPAD));

    expect(JSON.stringify(tree)).not.toContain("salary review notes");
  });

  test("drops the element token, which has expired by the time anyone clicks", () => {
    const tree = toPickerTree(snapshot(NOTEPAD));

    expect(JSON.stringify(tree)).not.toContain("s00000001:");
  });

  test("keeps what the UI draws the tree from, and the locator it would write", () => {
    const tree = toPickerTree(snapshot(NOTEPAD));

    expect(tree.elements[4]).toMatchObject({
      index: 4,
      role: "Button",
      label: "Close Tab",
      depth: 6,
      parentIndex: 2,
    });
    // Composed here rather than in the renderer: one algorithm, one place.
    expect(tree.elements[4].suggestion.matchedBy).toBe("ancestry");
  });

  test("carries the reason a window returned nothing", () => {
    const tree = toPickerTree(
      snapshot([], { degraded: true, degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements" }),
    );

    expect(tree.elements).toEqual([]);
    expect(tree.degradedReason).toContain("ax_tree_empty");
  });
});
