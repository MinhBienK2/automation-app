// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { createDesktopInspector } from "./inspector.js";
import type { DesktopHost } from "./session.js";
import type { DesktopTarget } from "../../../../src/types/desktopTargets.js";

const WINDOW = { window_id: "131204", pid: "4212", title: "Untitled - Notepad" };

const TREE = {
  snapshot_id: "snap-1",
  element_count: 2,
  elements: [
    { element_index: 0, element_token: "snap-1:0", role: "Window", label: "Untitled - Notepad", depth: 0 },
    { element_index: 1, element_token: "snap-1:1", role: "Document", label: "Text editor", depth: 1, parent_index: 0, value: "the operator's open file" },
  ],
};

const TARGET: DesktopTarget = {
  id: "target-1",
  project_id: "project-1",
  name: "Notepad",
  description: "",
  is_default: true,
  launch: { kind: "app_id", value: "notepad" },
  window: { title: { kind: "prefix", value: "Untitled" } },
  created_at: "2026-08-15T00:00:00.000Z",
  updated_at: "2026-08-15T00:00:00.000Z",
};

function fakeHost(replies: Record<string, unknown>) {
  const calls: string[] = [];
  const host: DesktopHost = {
    transport: {
      callTool(tool) {
        calls.push(tool);
        const reply = replies[tool];
        if (reply === undefined) return Promise.reject(new Error(`unexpected tool ${tool}`));
        return Promise.resolve({ structuredJson: reply, isError: false });
      },
    },
    stop: vi.fn(async () => {}),
  };
  return { host, calls };
}

const REPLIES = {
  list_apps: { apps: [{ pid: "1000" }] },
  launch_app: { pid: "4212", windows: [WINDOW] },
  get_window_state: TREE,
  kill_app: { ok: true },
};

describe("inspectDesktopTarget", () => {
  test("launches, snapshots once, and closes what it launched", async () => {
    const { host, calls } = fakeHost(REPLIES);
    const inspect = createDesktopInspector({ startHost: async () => host });

    await inspect(TARGET);

    expect(calls.filter((tool) => tool === "get_window_state")).toHaveLength(1);
    expect(calls).toContain("kill_app");
    expect(host.stop).toHaveBeenCalled();
  });

  test("hands back a tree with no element values in it", async () => {
    // The authoring UI needs roles, names and ancestry. A `Document` element's
    // value is the operator's whole open file, and it has no business crossing
    // the IPC boundary — see secrets-and-evidence.md.
    const { host } = fakeHost(REPLIES);
    const inspect = createDesktopInspector({ startHost: async () => host });

    const inspection = await inspect(TARGET);

    expect(JSON.stringify(inspection.tree)).not.toContain("the operator's open file");
    expect(inspection.tree.elements.map((e) => e.role)).toEqual(["Window", "Document"]);
  });

  test("records the tier it measured, because it measured a real window", async () => {
    const onTierObserved = vi.fn();
    const { host } = fakeHost(REPLIES);
    const inspect = createDesktopInspector({ startHost: async () => host, onTierObserved });

    const inspection = await inspect(TARGET);

    expect(inspection.tier).toBe("element");
    expect(onTierObserved).toHaveBeenCalledWith("target-1", "element");
  });

  test("a window with no tree still returns, with the reason", async () => {
    // This is the answer the operator most needs from the picker: not an error
    // dialog, but "this window exposes nothing, use screen position".
    const { host } = fakeHost({
      ...REPLIES,
      get_window_state: {
        snapshot_id: "snap-2",
        element_count: 0,
        elements: [],
        degraded: true,
        degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements",
      },
    });
    const inspect = createDesktopInspector({ startHost: async () => host });

    const inspection = await inspect(TARGET);

    expect(inspection.tier).toBe("pixel");
    expect(inspection.tree.degradedReason).toContain("ax_tree_empty");
    expect(inspection.warnings.join(" ")).toContain("ax_tree_empty");
  });

  test("closes the application even when the snapshot fails", async () => {
    const { host, calls } = fakeHost({ ...REPLIES, get_window_state: { nonsense: true } });
    const inspect = createDesktopInspector({ startHost: async () => host });

    await expect(inspect(TARGET)).rejects.toThrow(/unusable snapshot/);

    expect(calls).toContain("kill_app");
    expect(host.stop).toHaveBeenCalled();
  });
});
