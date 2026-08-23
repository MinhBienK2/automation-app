// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { createDesktopSurfaceOpener } from "./surfaceOpener.js";
import { requireDesktopSurface } from "../../runtime/surface.js";
import type { DesktopHost } from "./session.js";
import type { DesktopTarget } from "../../../../src/types/desktopTargets.js";

/**
 * The adapter between a Desktop Session and the runner's `OpenedSurface`.
 *
 * The only decision it makes is when to write the Capability Tier back to the
 * Desktop Target, and that decision moved: binding no longer probes, so the
 * tier is not known until the run has taken a snapshot of its own.
 */

const WINDOW = { window_id: "131204", pid: "4212", title: "Untitled - Notepad" };

const TREE = {
  snapshot_id: "snap-1",
  element_count: 2,
  elements: [
    { element_index: 0, element_token: "snap-1:0", role: "Window", label: "Untitled - Notepad", depth: 0 },
    { element_index: 1, element_token: "snap-1:1", role: "Document", parent_index: 0, depth: 1 },
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
  const host: DesktopHost = {
    transport: {
      callTool(tool) {
        const reply = replies[tool];
        if (reply === undefined) return Promise.reject(new Error(`unexpected tool ${tool}`));
        return Promise.resolve({ structuredJson: reply, isError: false });
      },
    },
    stop: vi.fn(async () => {}),
  };
  return host;
}

const REPLIES = {
  list_apps: { apps: [{ pid: "1000" }] },
  launch_app: { pid: "4212", windows: [WINDOW] },
  get_window_state: TREE,
  kill_app: { ok: true },
};

describe("createDesktopSurfaceOpener", () => {
  test("writes back the tier the run measured, once the run is over", async () => {
    const onTierObserved = vi.fn();
    const opener = createDesktopSurfaceOpener({
      startHost: async () => fakeHost(REPLIES),
      onTierObserved,
    });

    const opened = await opener({ target: TARGET, runId: "run-1" })();
    // Nothing is known yet: the tier arrives with the run's first snapshot.
    expect(onTierObserved).not.toHaveBeenCalled();

    const desktop = requireDesktopSurface(opened.surface);
    await desktop.driver.getWindowState(desktop.binding);
    await opened.close();

    expect(onTierObserved).toHaveBeenCalledWith("target-1", "element");
  });

  test("writes nothing when the run never looked at the tree", async () => {
    // A wholly pixel-addressed workflow takes no snapshot. Recording a tier for
    // it would replace a real measurement with a guess.
    const onTierObserved = vi.fn();
    const opener = createDesktopSurfaceOpener({
      startHost: async () => fakeHost(REPLIES),
      onTierObserved,
    });

    const opened = await opener({ target: { ...TARGET, observed_tier: "element" }, runId: "run-1" })();
    await opened.close();

    expect(onTierObserved).not.toHaveBeenCalled();
  });

  test("writes nothing when the tier is the one already recorded", async () => {
    const onTierObserved = vi.fn();
    const opener = createDesktopSurfaceOpener({
      startHost: async () => fakeHost(REPLIES),
      onTierObserved,
    });

    const opened = await opener({ target: { ...TARGET, observed_tier: "element" }, runId: "run-1" })();
    const desktop = requireDesktopSurface(opened.surface);
    await desktop.driver.getWindowState(desktop.binding);
    await opened.close();

    expect(onTierObserved).not.toHaveBeenCalled();
  });

  test("a failed write-back never stops the application from being closed", async () => {
    const host = fakeHost(REPLIES);
    const opener = createDesktopSurfaceOpener({
      startHost: async () => host,
      onTierObserved: () => {
        throw new Error("the database is gone");
      },
    });

    const opened = await opener({ target: TARGET, runId: "run-1" })();
    const desktop = requireDesktopSurface(opened.surface);
    await desktop.driver.getWindowState(desktop.binding);
    await opened.close();

    expect(host.stop).toHaveBeenCalled();
  });
});
