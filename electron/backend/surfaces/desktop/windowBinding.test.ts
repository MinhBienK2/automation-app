// @vitest-environment node

import { describe, expect, test } from "vitest";
import { classifyLaunch, parseWindowList, selectWindow } from "./windowBinding.js";
import type { DriverWindow } from "./types.js";

/**
 * Window lists are shaped like `list_windows` / `launch_app` output on
 * Windows 11 — see docs/research/cua-driver-windows.md. `pid` and `window_id`
 * arrive as bigint from the SDK and as string or number over JSON, which is
 * why parsing normalises both to string before anything else touches them.
 */

function win(over: Partial<DriverWindow> & { window_id: string }): DriverWindow {
  return {
    pid: "4212",
    is_minimized: false,
    is_on_screen: true,
    ...over,
  };
}

const NOTEPAD_MAIN = win({ window_id: "131204", title: "notes.txt - Notepad", z_order: 0 });
const NOTEPAD_FIND = win({ window_id: "131208", title: "Find", z_order: 1 });
const OTHER_APP = win({ window_id: "990001", pid: "8800", title: "Calculator" });

describe("parseWindowList", () => {
  test("normalises bigint-shaped ids to strings so nothing downstream mixes types", () => {
    // A window's `bounds` uses the long names. An element's `frame` uses the
    // short ones. Both measured, in the same driver, on the same day.
    const result = parseWindowList([
      {
        window_id: 131204,
        pid: 4212,
        title: "notes.txt - Notepad",
        bounds: { x: 0, y: 0, width: 800, height: 600 },
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows[0]).toMatchObject({ window_id: "131204", pid: "4212" });
  });

  test("accepts a window with no pid, which is how launch_app reports them", () => {
    // The pid belongs to the launch, one level up, so its window entries carry
    // none. Requiring one rejected the reply most certainly from the right
    // process, and every desktop run failed at binding.
    const result = parseWindowList({
      pid: 4212,
      windows: [{ window_id: 131204, title: "Home - File Explorer", z_index: 3 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows[0]).toMatchObject({ window_id: "131204" });
    expect(result.windows[0].pid).toBeUndefined();
  });

  test("accepts the envelope `launch_app` returns as well as a bare array", () => {
    const result = parseWindowList({ windows: [{ window_id: "1", pid: "2" }] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows).toHaveLength(1);
  });

  test("a window without an id is rejected rather than half-bound", () => {
    const result = parseWindowList([{ pid: "4212", title: "notes.txt - Notepad" }]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("window_id");
  });
});

describe("selectWindow", () => {
  test("binds the only on-screen window of the launched process", () => {
    const result = selectWindow([NOTEPAD_MAIN, OTHER_APP], { pid: "4212" }, {});

    expect(result).toMatchObject({
      ok: true,
      binding: { pid: "4212", windowId: "131204", title: "notes.txt - Notepad" },
    });
  });

  test("windows of other processes are never candidates", () => {
    const result = selectWindow([OTHER_APP], { pid: "4212" }, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_windows");
  });

  test("minimised and off-screen windows are excluded, and the detail says so", () => {
    const hidden = [
      win({ window_id: "1", title: "notes.txt - Notepad", is_minimized: true }),
      win({ window_id: "2", title: "notes.txt - Notepad", is_on_screen: false }),
    ];

    const result = selectWindow(hidden, { pid: "4212" }, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_windows");
    expect(result.detail).toContain("minimised");
    expect(result.candidates).toHaveLength(2);
  });

  test("a title matcher picks the main window out of a dialog", () => {
    const result = selectWindow(
      [NOTEPAD_MAIN, NOTEPAD_FIND],
      { pid: "4212" },
      { title: { kind: "prefix", value: "notes.txt" } },
    );

    expect(result).toMatchObject({ ok: true, binding: { windowId: "131204" } });
  });

  test("several matches without an ordinal fails and lists what it found", () => {
    // Binding the wrong window means the workflow types into the wrong place.
    const result = selectWindow([NOTEPAD_MAIN, NOTEPAD_FIND], { pid: "4212" }, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ambiguous");
    expect(result.detail).toContain("notes.txt - Notepad");
    expect(result.detail).toContain("Find");
    expect(result.candidates).toHaveLength(2);
  });

  test("an ordinal counts by z-order, not by the order the driver listed them", () => {
    const listedBackwards = [
      win({ window_id: "back", title: "Editor", z_order: 3 }),
      win({ window_id: "front", title: "Editor", z_order: 1 }),
    ];

    const result = selectWindow(listedBackwards, { pid: "4212" }, { ordinal: 0 });

    expect(result).toMatchObject({ ok: true, binding: { windowId: "front" } });
  });

  test("an out-of-range ordinal reports the range instead of binding nothing", () => {
    const result = selectWindow([NOTEPAD_MAIN, NOTEPAD_FIND], { pid: "4212" }, { ordinal: 5 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ambiguous");
    expect(result.detail).toContain("2");
  });

  test("an attached launch is carried into the binding, not silently forgotten", () => {
    // The run continues, but a failure caused by inherited state has to be
    // diagnosable afterwards.
    const result = selectWindow([NOTEPAD_MAIN], { pid: "4212", attached: true }, {});

    expect(result).toMatchObject({ ok: true, binding: { attached: true } });
  });
});

describe("classifyLaunch", () => {
  test("a pid that was already running means the launch attached to it", () => {
    expect(classifyLaunch(["4212", "8800"], "4212")).toBe("attached");
  });

  test("a new pid is a genuine launch", () => {
    expect(classifyLaunch(["8800"], "4212")).toBe("launched");
  });

  test("an unknown prior-pid list cannot prove a launch, so it reports attached", () => {
    // Guessing "launched" would record a clean start that may never have
    // happened; the conservative reading is the one that stays honest.
    expect(classifyLaunch(undefined, "4212")).toBe("attached");
  });
});
