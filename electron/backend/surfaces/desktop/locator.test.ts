// @vitest-environment node

import { describe, expect, test } from "vitest";
import { ancestorsOf, matchesName, resolveDesktopLocator } from "./locator.js";
import type { ElementSnapshot, SnapshotElement } from "./types.js";

/**
 * Fixtures are real trees captured from Windows 11 via cua-driver 0.19.3,
 * not invented shapes — see docs/research/cua-driver-windows.md. The Notepad
 * tab strip in particular is the ambiguity case that motivated ancestry:
 * every tab owns its own "Close Tab" button with an identical label.
 */

function snapshot(elements: SnapshotElement[], extra: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    snapshot_id: "s00000001",
    elements,
    element_count: elements.length,
    ...extra,
  };
}

const NOTEPAD: SnapshotElement[] = [
  { depth: 2, element_index: 0, element_token: "s00000001:0", role: "Document", label: "Text editor", value: "secret file contents" },
  { depth: 4, element_index: 1, element_token: "s00000001:1", role: "List", label: "TabListView" },
  { depth: 5, element_index: 2, element_token: "s00000001:2", role: "TabItem", label: "Bo. Modified.", parent_index: 1 },
  { depth: 6, element_index: 3, element_token: "s00000001:3", role: "Text", label: "Bo", parent_index: 2 },
  { depth: 6, element_index: 4, element_token: "s00000001:4", role: "Button", label: "Close Tab", parent_index: 2 },
  { depth: 5, element_index: 5, element_token: "s00000001:5", role: "TabItem", label: "notes.txt. Unmodified.", parent_index: 1 },
  { depth: 6, element_index: 6, element_token: "s00000001:6", role: "Button", label: "Close Tab", parent_index: 5 },
  { depth: 4, element_index: 7, element_token: "s00000001:7", role: "Button", label: "Add New Tab" },
  { depth: 4, element_index: 8, element_token: "s00000001:8", role: "MenuItem", label: "File" },
];

const CALCULATOR: SnapshotElement[] = [
  { depth: 3, element_index: 3, element_token: "s00000001:3", role: "Text", label: "Display is 0" },
  { depth: 4, element_index: 27, element_token: "s00000001:27", role: "Button", label: "Seven", frame: { x: 4, y: 405, w: 97, h: 63 } },
  { depth: 4, element_index: 28, element_token: "s00000001:28", role: "Button", label: "Eight" },
];

describe("matchesName", () => {
  test("an absent matcher accepts anything, including unnamed elements", () => {
    expect(matchesName(undefined, "Seven")).toBe(true);
    expect(matchesName(undefined, undefined)).toBe(true);
  });

  test("an unnamed element never satisfies a matcher that was specified", () => {
    expect(matchesName({ kind: "exact", value: "Seven" }, undefined)).toBe(false);
  });

  test("prefix survives the trailing state Windows appends to tab labels", () => {
    expect(matchesName({ kind: "prefix", value: "notes.txt" }, "notes.txt. Unmodified.")).toBe(true);
    expect(matchesName({ kind: "prefix", value: "notes.txt" }, "notes.txt. Modified.")).toBe(true);
  });

  test("patterns are anchored, so a locator cannot match a longer label", () => {
    expect(matchesName({ kind: "pattern", value: "Save" }, "Save")).toBe(true);
    expect(matchesName({ kind: "pattern", value: "Save" }, "Save As")).toBe(false);
    expect(matchesName({ kind: "pattern", value: "Save( As)?" }, "Save As")).toBe(true);
  });
});

describe("ancestorsOf", () => {
  test("returns the chain nearest-first", () => {
    const closeTab = NOTEPAD[4];

    expect(ancestorsOf(closeTab, NOTEPAD).map((e) => e.label)).toEqual([
      "Bo. Modified.",
      "TabListView",
    ]);
  });

  test("a root element has no ancestors", () => {
    expect(ancestorsOf(NOTEPAD[0], NOTEPAD)).toEqual([]);
  });

  test("a parent_index cycle terminates instead of hanging", () => {
    const cyclic: SnapshotElement[] = [
      { depth: 1, element_index: 0, element_token: "t:0", role: "Pane", parent_index: 1 },
      { depth: 1, element_index: 1, element_token: "t:1", role: "Pane", parent_index: 0 },
    ];

    expect(() => ancestorsOf(cyclic[0], cyclic)).not.toThrow();
    expect(ancestorsOf(cyclic[0], cyclic).length).toBeLessThanOrEqual(2);
  });

  test("a dangling parent_index ends the chain rather than throwing", () => {
    const orphan: SnapshotElement[] = [
      { depth: 2, element_index: 0, element_token: "t:0", role: "Button", parent_index: 99 },
    ];

    expect(ancestorsOf(orphan[0], orphan)).toEqual([]);
  });
});

describe("resolveDesktopLocator", () => {
  test("resolves a unique role and name to the driver's snapshot-scoped token", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Seven" } },
      snapshot(CALCULATOR),
    );

    expect(result).toMatchObject({
      ok: true,
      elementToken: "s00000001:27",
      snapshotId: "s00000001",
    });
  });

  test("ambiguity fails loudly instead of picking a match", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Close Tab" } },
      snapshot(NOTEPAD),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ambiguous");
    expect(result).toHaveProperty("candidates");
    if (result.reason !== "ambiguous") return;
    expect(result.candidates).toHaveLength(2);
    expect(result.detail).toContain("disambiguate");
  });

  test("an ancestor disambiguates identical siblings", () => {
    const result = resolveDesktopLocator(
      {
        role: "Button",
        name: { kind: "exact", value: "Close Tab" },
        ancestors: [{ role: "TabItem", name: { kind: "prefix", value: "notes.txt" } }],
      },
      snapshot(NOTEPAD),
    );

    expect(result).toMatchObject({ ok: true, elementToken: "s00000001:6" });
  });

  test("ancestors may be separated by unnamed containers", () => {
    // "TabListView" is the grandparent of Close Tab, not its parent.
    const result = resolveDesktopLocator(
      {
        role: "Button",
        name: { kind: "exact", value: "Close Tab" },
        ancestors: [
          { role: "TabItem", name: { kind: "prefix", value: "Bo" } },
          { role: "List", name: { kind: "exact", value: "TabListView" } },
        ],
      },
      snapshot(NOTEPAD),
    );

    expect(result).toMatchObject({ ok: true, elementToken: "s00000001:4" });
  });

  test("ancestors must appear in order, nearest first", () => {
    const reversed = resolveDesktopLocator(
      {
        role: "Button",
        name: { kind: "exact", value: "Close Tab" },
        ancestors: [
          { role: "List", name: { kind: "exact", value: "TabListView" } },
          { role: "TabItem", name: { kind: "prefix", value: "Bo" } },
        ],
      },
      snapshot(NOTEPAD),
    );

    expect(reversed.ok).toBe(false);
  });

  test("an ordinal resolves ambiguity when ancestry cannot", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Close Tab" }, ordinal: 1 },
      snapshot(NOTEPAD),
    );

    expect(result).toMatchObject({ ok: true, elementToken: "s00000001:6" });
  });

  test("an out-of-range ordinal reports its range rather than resolving", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Close Tab" }, ordinal: 7 },
      snapshot(NOTEPAD),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
    expect(result.detail).toContain("out of range");
  });

  test("automationId short-circuits role and name entirely", () => {
    const withIds: SnapshotElement[] = [
      { depth: 4, element_index: 0, element_token: "s:0", role: "Button", label: "Lưu", automation_id: "saveButton" },
      { depth: 4, element_index: 1, element_token: "s:1", role: "Button", label: "Lưu", automation_id: "saveAsButton" },
    ];

    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Lưu" }, automationId: "saveAsButton" },
      snapshot(withIds),
    );

    expect(result).toMatchObject({ ok: true, elementToken: "s:1" });
  });

  test("a missing automationId falls back to role and name rather than failing", () => {
    // Apps do drop AutomationIds between versions; the rest of the locator
    // is still a legitimate description of the element.
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Seven" }, automationId: "gone" },
      snapshot(CALCULATOR),
    );

    expect(result).toMatchObject({ ok: true, elementToken: "s00000001:27" });
  });

  test("a degraded window is reported as degraded, never as a missing element", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Seven" } },
      snapshot([], { degraded: true, degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements." }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("degraded");
    expect(result.detail).toContain("ax_tree_empty");
  });

  test("an empty tree with no degraded flag is still degraded, not a missing element", () => {
    // The UWP collapse case does not always set the flag. An empty tree is a
    // window that lost its provider, and saying "element not found" would send
    // the operator to re-author a step that is fine.
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Seven" } },
      snapshot([]),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("degraded");
  });

  test("a genuinely absent element is not_found and names what was sought", () => {
    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Nine" } },
      snapshot(CALCULATOR),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
    expect(result.detail).toContain("Nine");
  });

  test("matching the role but not the ancestry explains which half failed", () => {
    const result = resolveDesktopLocator(
      {
        role: "Button",
        name: { kind: "exact", value: "Close Tab" },
        ancestors: [{ role: "TabItem", name: { kind: "exact", value: "absent.txt" } }],
      },
      snapshot(NOTEPAD),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
    expect(result.detail).toContain("but none under");
  });

  test("resolution never returns a token from a different snapshot", () => {
    const second = snapshot(CALCULATOR.map((e) => ({ ...e, element_token: e.element_token.replace("s00000001", "s00000002") })), {
      snapshot_id: "s00000002",
    });

    const result = resolveDesktopLocator(
      { role: "Button", name: { kind: "exact", value: "Seven" } },
      second,
    );

    expect(result).toMatchObject({ ok: true, snapshotId: "s00000002", elementToken: "s00000002:27" });
  });
});
