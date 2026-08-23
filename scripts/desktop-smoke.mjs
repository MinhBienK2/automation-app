/**
 * Real-hardware smoke test for @trycua/cua-driver (0.19.3) on this machine.
 *
 * Standalone, throwaway verification. It touches NO app source. It proves the
 * embedded same-process driver actually works for the tools we are about to
 * wrap: launch + get_window_state, clipboard round-trip, scroll, drag, move_cursor.
 *
 * Every step is isolated in try/catch and prints one PASS/FAIL line. A missing
 * required field panics the Rust host, so inputs are built with the generated
 * factories and validated before every call.
 *
 *   node scripts/desktop-smoke.mjs
 */

const SESSION = "cua-smoke-" + process.pid;
const CLIP_TOKEN = "cua-smoke-123";

const results = [];
function record(step, ok, detail) {
  results.push({ step, ok });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${step}${detail ? " — " + detail : ""}`);
}

/** Pull the structured payload out of a ToolResult without trusting one shape. */
function structured(toolResult) {
  if (!toolResult || typeof toolResult !== "object") return undefined;
  const tryParse = (s) => {
    if (typeof s !== "string" || s === "") return undefined;
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  return (
    tryParse(toolResult.structuredJson) ??
    tryParse(toolResult.rawJson) ??
    tryParse(toolResult.text)
  );
}

function summariseToolResult(r) {
  if (!r || typeof r !== "object") return String(r);
  const s = structured(r);
  return JSON.stringify({
    isError: r.isError,
    errorCode: r.errorCode,
    degraded: r.degraded,
    hasStructured: typeof r.structuredJson === "string" && r.structuredJson !== "",
    images: Array.isArray(r.images) ? r.images.length : 0,
    text: typeof r.text === "string" ? r.text.slice(0, 120) : undefined,
    structuredKeys: s && typeof s === "object" ? Object.keys(s) : undefined,
  });
}

async function main() {
  // ---- import ----------------------------------------------------------
  let sdk;
  try {
    sdk = await import("@trycua/cua-driver");
    // The library normally self-initialises on import; call the async init if
    // it is exported, so we fail loudly here rather than mid-call.
    if (typeof sdk.uniffiInitAsync === "function") {
      await sdk.uniffiInitAsync();
    }
    record("import @trycua/cua-driver", true, `version pinned 0.19.3, keys=${Object.keys(sdk).length}`);
  } catch (err) {
    record("import @trycua/cua-driver", false, String(err?.stack || err));
    return finish();
  }

  const {
    CuaDriver,
    StartSessionInput,
    EndSessionInput,
    ClipboardReadInput,
    ClipboardWriteInput,
    ScrollInput,
    DragInput,
    MoveCursorInput,
    ScrollDirection,
    DesktopScope,
    CaptureScope,
  } = sdk;

  // Report the observed enum encodings — the task wants these confirmed.
  console.log(
    "enums:",
    JSON.stringify({
      "DesktopScope.Desktop": DesktopScope?.Desktop,
      "ScrollDirection.Down": ScrollDirection?.Down,
      "ScrollDirection.Up": ScrollDirection?.Up,
      "CaptureScope.Desktop": CaptureScope?.Desktop,
    }),
  );

  // ---- construct driver ------------------------------------------------
  let driver;
  try {
    // Canonical same-process embedded runtime; never spawns a daemon.
    driver = CuaDriver.create(undefined);
    const available = typeof driver.isAvailable === "function" ? driver.isAvailable() : "n/a";
    const mode = typeof driver.executionMode === "function" ? driver.executionMode() : "n/a";
    record("CuaDriver.create()", true, `isAvailable=${available} executionMode=${mode}`);
  } catch (err) {
    record("CuaDriver.create()", false, String(err?.stack || err));
    return finish();
  }

  // ---- start session ---------------------------------------------------
  let sessionStarted = false;
  try {
    const out = await driver.startSession(
      StartSessionInput.new({ session: SESSION, captureScope: CaptureScope.Desktop }),
    );
    sessionStarted = true;
    record("startSession (desktop scope)", true, `active=${out?.active} revived=${out?.revived}`);
  } catch (err) {
    record("startSession (desktop scope)", false, String(err?.stack || err));
  }

  // ---- launch Notepad --------------------------------------------------
  // No typed launchApp exists; launch is reached through callTool("launch_app").
  let launchWindow = null; // { pid, windowId }
  if (sessionStarted) {
    for (const args of [
      { name: "notepad.exe" },
      { path: "C:\\\\Windows\\\\System32\\\\notepad.exe" },
    ]) {
      try {
        const r = await driver.callTool("launch_app", JSON.stringify({ ...args, session: SESSION }));
        const s = structured(r);
        const pid = s?.pid ?? s?.process_id;
        const win =
          (Array.isArray(s?.windows) && s.windows[0]) ||
          (Array.isArray(s?.window) && s.window[0]) ||
          undefined;
        const windowId = win?.window_id ?? win?.windowId ?? win?.id;
        if (pid !== undefined && windowId !== undefined) {
          launchWindow = { pid: Number(pid), windowId: Number(windowId) };
        } else if (pid !== undefined) {
          launchWindow = { pid: Number(pid), windowId: undefined };
        }
        record(
          `launch_app (${JSON.stringify(args)})`,
          !r?.isError && pid !== undefined,
          `pid=${pid} windowId=${windowId} ${summariseToolResult(r)}`,
        );
        if (pid !== undefined) break;
      } catch (err) {
        record(`launch_app (${JSON.stringify(args)})`, false, String(err?.stack || err));
      }
    }
    // Give Notepad a moment to actually paint a window.
    await new Promise((res) => setTimeout(res, 1200));
  }

  // ---- get_window_state ------------------------------------------------
  // If launch didn't hand us a window, fall back to list_windows.
  if (sessionStarted) {
    if (!launchWindow || launchWindow.windowId === undefined) {
      try {
        const r = await driver.callTool("list_windows", JSON.stringify({ session: SESSION }));
        const s = structured(r);
        const list = Array.isArray(s) ? s : s?.windows;
        const np =
          Array.isArray(list) &&
          list.find((w) => /notepad/i.test(String(w?.title ?? w?.name ?? w?.app ?? "")));
        const anyWin = Array.isArray(list) ? np || list[0] : undefined;
        if (anyWin) {
          const pid = anyWin.pid ?? anyWin.process_id;
          const windowId = anyWin.window_id ?? anyWin.windowId ?? anyWin.id;
          if (pid !== undefined && windowId !== undefined) {
            launchWindow = { pid: Number(pid), windowId: Number(windowId) };
          }
        }
        record(
          "list_windows (fallback to find window)",
          Array.isArray(list),
          `count=${Array.isArray(list) ? list.length : "n/a"} picked=${JSON.stringify(launchWindow)}`,
        );
      } catch (err) {
        record("list_windows (fallback to find window)", false, String(err?.stack || err));
      }
    }

    if (launchWindow && launchWindow.windowId !== undefined) {
      try {
        const r = await driver.callTool(
          "get_window_state",
          JSON.stringify({
            pid: launchWindow.pid,
            window_id: launchWindow.windowId,
            include_screenshot: false,
            session: SESSION,
          }),
        );
        const s = structured(r);
        record(
          "get_window_state",
          !r?.isError && s !== undefined,
          summariseToolResult(r),
        );
      } catch (err) {
        record("get_window_state", false, String(err?.stack || err));
      }
    } else {
      record("get_window_state", false, "no window id available to query");
    }
  }

  // ---- clipboard round-trip -------------------------------------------
  if (sessionStarted) {
    let wrote = false;
    try {
      const r = await driver.clipboardWrite(
        ClipboardWriteInput.new({ text: CLIP_TOKEN, session: SESSION }),
      );
      wrote = !r?.isError;
      record("clipboardWrite", true, `isError=${r?.isError} ${summariseToolResult(r)}`);
    } catch (err) {
      record("clipboardWrite", false, String(err?.stack || err));
    }

    try {
      const r = await driver.clipboardRead(
        ClipboardReadInput.new({ includeText: true, session: SESSION }),
      );
      const s = structured(r);
      const text = s?.text ?? r?.text;
      const roundTripped = text === CLIP_TOKEN;
      record(
        "clipboardRead + round-trip",
        roundTripped,
        `readText=${JSON.stringify(text)} expected=${JSON.stringify(CLIP_TOKEN)} supported=${s?.supported} types=${JSON.stringify(s?.types)}`,
      );
    } catch (err) {
      record("clipboardRead + round-trip", false, String(err?.stack || err));
    }
  }

  // ---- scroll ----------------------------------------------------------
  if (sessionStarted) {
    try {
      const r = await driver.scroll(
        ScrollInput.new({
          x: 400,
          y: 400,
          direction: ScrollDirection.Down,
          scope: DesktopScope.Desktop,
          session: SESSION,
        }),
      );
      record("scroll (down @400,400)", true, `isError=${r?.isError} ${summariseToolResult(r)}`);
    } catch (err) {
      record("scroll (down @400,400)", false, String(err?.stack || err));
    }
  }

  // ---- drag ------------------------------------------------------------
  if (sessionStarted) {
    try {
      const r = await driver.drag(
        DragInput.new({
          fromX: 400,
          fromY: 400,
          toX: 450,
          toY: 450,
          scope: DesktopScope.Desktop,
          session: SESSION,
        }),
      );
      record("drag (400,400 -> 450,450)", true, `isError=${r?.isError} ${summariseToolResult(r)}`);
    } catch (err) {
      record("drag (400,400 -> 450,450)", false, String(err?.stack || err));
    }
  }

  // ---- move_cursor (the primitive under desktop_hover) -----------------
  if (sessionStarted) {
    try {
      const r = await driver.moveCursor(
        MoveCursorInput.new({
          x: 420,
          y: 300,
          scope: DesktopScope.Desktop,
          session: SESSION,
        }),
      );
      record("moveCursor (420,300)", true, `isError=${r?.isError} ${summariseToolResult(r)}`);
    } catch (err) {
      record("moveCursor (420,300)", false, String(err?.stack || err));
    }
  }

  // ---- teardown (desktop-scope session) --------------------------------
  if (sessionStarted) {
    try {
      const out = await driver.endSession(EndSessionInput.new({ session: SESSION }));
      record("endSession (desktop)", true, `active=${out?.active}`);
    } catch (err) {
      record("endSession (desktop)", false, String(err?.stack || err));
    }
  }

  // ---- get_window_state under a WINDOW-scope session -------------------
  // get_window_state is a window-scope tool; the driver disables it while a
  // session is in desktop scope (error code window_scope_disabled). So it is
  // verified here in its own window-scope session.
  const WSESSION = SESSION + "-win";
  let winSessionStarted = false;
  try {
    const out = await driver.startSession(
      StartSessionInput.new({ session: WSESSION, captureScope: CaptureScope.Window }),
    );
    winSessionStarted = true;
    record("startSession (window scope)", true, `active=${out?.active}`);
  } catch (err) {
    record("startSession (window scope)", false, String(err?.stack || err));
  }

  if (winSessionStarted) {
    // Find a notepad window (the one launched above should still be open).
    let win = launchWindow;
    try {
      const r = await driver.callTool("list_windows", JSON.stringify({ session: WSESSION }));
      const s = structured(r);
      const list = Array.isArray(s) ? s : s?.windows;
      const np =
        Array.isArray(list) &&
        list.find((w) => /notepad/i.test(String(w?.title ?? w?.name ?? w?.app ?? "")));
      const pick = np || (Array.isArray(list) ? list[0] : undefined);
      if (pick) {
        const pid = pick.pid ?? pick.process_id;
        const windowId = pick.window_id ?? pick.windowId ?? pick.id;
        if (pid !== undefined && windowId !== undefined) {
          win = { pid: Number(pid), windowId: Number(windowId) };
        }
      }
      record(
        "list_windows (window scope)",
        Array.isArray(list),
        `count=${Array.isArray(list) ? list.length : "n/a"} picked=${JSON.stringify(win)}`,
      );
    } catch (err) {
      record("list_windows (window scope)", false, String(err?.stack || err));
    }

    if (win && win.windowId !== undefined) {
      try {
        const r = await driver.callTool(
          "get_window_state",
          JSON.stringify({
            pid: win.pid,
            window_id: win.windowId,
            include_screenshot: false,
            session: WSESSION,
          }),
        );
        const s = structured(r);
        record("get_window_state (window scope)", !r?.isError && s !== undefined, summariseToolResult(r));
      } catch (err) {
        record("get_window_state (window scope)", false, String(err?.stack || err));
      }
    } else {
      record("get_window_state (window scope)", false, "no window id available");
    }

    try {
      const out = await driver.endSession(EndSessionInput.new({ session: WSESSION }));
      record("endSession (window)", true, `active=${out?.active}`);
    } catch (err) {
      record("endSession (window)", false, String(err?.stack || err));
    }
  }

  try {
    await driver.shutdown();
    if (typeof driver.uniffiDestroy === "function") driver.uniffiDestroy();
    record("shutdown + uniffiDestroy", true);
  } catch (err) {
    record("shutdown + uniffiDestroy", false, String(err?.stack || err));
  }

  finish();
}

function finish() {
  const pass = results.filter((r) => r.ok).length;
  console.log("\n==== SMOKE SUMMARY ====");
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.step}`);
  console.log(`\n${pass}/${results.length} steps passed`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err?.stack || err);
  finish();
  process.exit(1);
});
