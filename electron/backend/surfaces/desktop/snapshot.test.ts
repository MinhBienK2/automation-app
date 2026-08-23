// @vitest-environment node

import { describe, expect, test } from "vitest";
import { parseSnapshot, snapshotWarnings, tierOf } from "./snapshot.js";
import type { ElementSnapshot, SnapshotElement } from "./types.js";

/**
 * Payloads here are shaped like real `get_window_state` output captured on
 * Windows 11 via cua-driver 0.19.3 — see docs/research/cua-driver-windows.md.
 */

function snapshot(elements: SnapshotElement[], extra: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    snapshot_id: "s00000001",
    elements,
    element_count: elements.length,
    ...extra,
  };
}

const CALCULATOR: SnapshotElement[] = [
  { depth: 3, element_index: 3, element_token: "s00000001:3", role: "Text", label: "Display is 0" },
  { depth: 4, element_index: 27, element_token: "s00000001:27", role: "Button", label: "Seven", frame: { x: 4, y: 405, w: 97, h: 63 } },
];

const CHROME_ONLY: SnapshotElement[] = [
  { depth: 5, element_index: 0, element_token: "s00000002:0", role: "Button", label: "Minimize" },
  { depth: 5, element_index: 1, element_token: "s00000002:1", role: "Button", label: "Restore" },
  { depth: 5, element_index: 2, element_token: "s00000002:2", role: "Button", label: "Close" },
];

describe("parseSnapshot", () => {
  test("parses a healthy payload, keeping the fields an action needs", () => {
    const result = parseSnapshot({
      snapshot_id: "s00000001",
      element_count: 1,
      elements: [
        {
          depth: 4,
          element_index: 27,
          element_token: "s00000001:27",
          enabled: true,
          frame: { h: 63, w: 97, x: 4, y: 405 },
          label: "Seven",
          role: "Button",
          parent_index: 1,
        },
      ],
      degraded: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.snapshot_id).toBe("s00000001");
    expect(result.snapshot.elements[0]).toMatchObject({
      element_token: "s00000001:27",
      label: "Seven",
      parent_index: 1,
      frame: { x: 4, y: 405, w: 97, h: 63 },
    });
  });

  test("tolerates fields the driver adds that we do not model", () => {
    // 16 releases in three weeks — new fields are expected, and a new field
    // is not a reason to fail a run.
    const result = parseSnapshot({
      snapshot_id: "s00000001",
      element_count: 1,
      elements: [
        { depth: 1, element_index: 0, element_token: "s00000001:0", role: "Button", some_new_field: 7 },
      ],
      some_new_envelope_field: true,
    });

    expect(result.ok).toBe(true);
  });

  test("a degraded window with no elements is a valid snapshot, not a parse failure", () => {
    // This is the WinUI case. It must reach the caller as a degraded snapshot
    // so the failure reads "the window lost its tree", not "the driver broke".
    const result = parseSnapshot({
      snapshot_id: "s00000003",
      element_count: 0,
      elements: [],
      degraded: true,
      degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements.",
      escalation: { reason: "non-AX surface — act by pixel (x,y)", recommended: "px" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.degraded).toBe(true);
    expect(result.snapshot.escalation?.recommended).toBe("px");
    expect(tierOf(result.snapshot)).toBe("pixel");
  });

  test("a payload that is not an object is rejected with a readable detail", () => {
    expect(parseSnapshot("s00000001")).toMatchObject({ ok: false });
    expect(parseSnapshot(null)).toMatchObject({ ok: false });
  });

  test("a missing snapshot_id is rejected, because every token depends on it", () => {
    const result = parseSnapshot({ element_count: 0, elements: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("snapshot_id");
  });

  test("a malformed element fails the parse and names which one", () => {
    // Silently dropping it would turn a driver contract break into an
    // "element not found" that sends the operator to re-author a fine step.
    const result = parseSnapshot({
      snapshot_id: "s00000001",
      element_count: 2,
      elements: [
        { depth: 1, element_index: 0, element_token: "s00000001:0", role: "Button" },
        { depth: 1, element_index: 1, role: "Button" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("element_token");
    expect(result.detail).toContain("1");
  });

  test("an unrecognised escalation recommendation warns instead of failing the parse", () => {
    // Rejecting an unfamiliar value would throw away a usable tree over a
    // field that only advises. Only "px" has been measured.
    const result = parseSnapshot({
      snapshot_id: "s00000001",
      element_count: 1,
      elements: [{ depth: 1, element_index: 0, element_token: "s00000001:0", role: "Button", label: "Seven" }],
      escalation: { reason: "something new", recommended: "quantum" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(tierOf(result.snapshot)).toBe("element");
    expect(snapshotWarnings(result.snapshot).join(" ")).toContain("quantum");
  });
});

describe("tierOf", () => {
  test("a usable tree is the element tier", () => {
    expect(tierOf(snapshot(CALCULATOR))).toBe("element");
  });

  test("frame controls alone are the chrome tier — this is the Electron case", () => {
    expect(tierOf(snapshot(CHROME_ONLY))).toBe("chrome");
  });

  test("the driver's own degraded flag wins over element count", () => {
    expect(tierOf(snapshot(CALCULATOR, { degraded: true, degraded_reason: "ax_tree_empty" }))).toBe("pixel");
  });

  test("an escalation recommending pixels is honoured even when undegraded", () => {
    const escalating = snapshot(CALCULATOR, {
      escalation: { reason: "non-AX surface", recommended: "px" },
    });

    expect(tierOf(escalating)).toBe("pixel");
  });

  test("an empty tree is the pixel tier", () => {
    expect(tierOf(snapshot([]))).toBe("pixel");
  });

  test("elements_complete: false does not lower the tier", () => {
    // It appears on healthy snapshots too; its meaning is unresolved upstream,
    // so it is a warning and never a tier signal.
    expect(tierOf(snapshot(CALCULATOR, { elements_complete: false }))).toBe("element");
  });
});

describe("snapshotWarnings", () => {
  test("a healthy snapshot warns about nothing", () => {
    expect(snapshotWarnings(snapshot(CALCULATOR))).toEqual([]);
  });

  test("a bounded walk is surfaced as a partial-tree warning", () => {
    const warnings = snapshotWarnings(snapshot(CALCULATOR, { elements_complete: false }));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("partial");
  });

  test("a count that disagrees with the tree is surfaced rather than reconciled", () => {
    const warnings = snapshotWarnings(snapshot(CALCULATOR, { element_count: 34 }));

    expect(warnings.join(" ")).toContain("34");
  });

  test("a chrome-tier window warns that only the frame is reachable", () => {
    expect(snapshotWarnings(snapshot(CHROME_ONLY)).join(" ")).toContain("window frame");
  });
});
