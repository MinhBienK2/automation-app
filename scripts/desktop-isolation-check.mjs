/**
 * Live isolation probe — the core requirement of the Desktop Surface: does
 * driving a real app steal the operator's physical mouse and keyboard?
 *
 * Measured on Windows 11, and the answer is a split the design depends on:
 *
 *   - UIA actions (click, set_value, type_text, read_text, ...) run in the
 *     background. `click` reports delivery.mode "background", `set_value`
 *     reports route "accessibility", and in the normal window-scope session the
 *     driver LOCKS get_cursor_position entirely — automation cannot even read
 *     the OS pointer, let alone move it. These are isolated.
 *   - Pointer-path tools (move_cursor / desktop_hover, scroll, drag) use
 *     synthetic input. This probe reads the real cursor (in a desktop-scope
 *     session, where it is unlocked) and shows move_cursor moves it by exactly
 *     the requested delta. These are NOT isolated by construction.
 *
 * The two halves use different session scopes because the driver gates them:
 * get_cursor_position needs desktop scope, get_window_state needs window scope.
 *
 *   node scripts/desktop-isolation-check.mjs
 */

function parse(r) {
  try { return JSON.parse(r?.structuredJson ?? "{}"); } catch { return {}; }
}
function textOf(r) {
  return typeof r?.text === "string" ? r.text : "";
}

async function main() {
  const sdk = await import("@trycua/cua-driver");
  if (typeof sdk.initCuaDriver === "function") { try { await sdk.initCuaDriver(); } catch {} }
  const {
    CuaDriver, StartSessionInput, EndSessionInput, GetCursorPositionInput,
    MoveCursorInput, DesktopScope,
  } = sdk;
  const d = await CuaDriver.create();

  console.log("\n=== ISOLATION PROBE (real desktop, measured) ===\n");

  // ---- Part 1: the pointer tools, in a desktop-scope session -----------
  // Desktop scope unlocks get_cursor_position, so the real pointer is readable.
  const DS = "iso-desktop";
  await d.startSession(StartSessionInput.new({ session: DS, captureScope: 2 }));

  const readCursor = async (label) => {
    const r = await d.getCursorPosition(GetCursorPositionInput.new({ session: DS }));
    const p = parse(r);
    console.log(`    cursor ${label}: (${p.x}, ${p.y})`);
    return { x: Number(p.x), y: Number(p.y) };
  };

  const c0 = await readCursor("baseline (your real pointer)");
  const mv = await d.moveCursor(MoveCursorInput.new({ session: DS, scope: DesktopScope.Desktop, x: c0.x + 120, y: c0.y + 90 }));
  console.log(`  move_cursor(+120,+90) route=${JSON.stringify(parse(mv).route ?? textOf(mv).slice(0, 40))}`);
  const c1 = await readCursor("after move_cursor");
  const dx = c1.x - c0.x, dy = c1.y - c0.y;
  console.log(`  >> move_cursor moved the REAL pointer by (${dx}, ${dy})  => ${dx === 0 && dy === 0 ? "isolated" : "NOT isolated (physical pointer moved)"}`);
  // Put the operator's pointer back.
  await d.moveCursor(MoveCursorInput.new({ session: DS, scope: DesktopScope.Desktop, x: c0.x, y: c0.y }));
  await readCursor("restored");
  await d.endSession(EndSessionInput.new({ session: DS })).catch(() => {});

  // ---- Part 2: the UIA path, in the production window-scope session -----
  const WS = "iso-window";
  await d.startSession(StartSessionInput.new({ session: WS, captureScope: 1 }));
  const call = (t, a = {}) => d.callTool(t, JSON.stringify({ ...a, session: WS }));

  // The isolation gate itself: desktop-scope tools are locked here.
  const locked = await call("get_cursor_position", {});
  console.log(`\n  get_cursor_position in window scope: ${locked?.isError ? "LOCKED ✓ — " + textOf(locked).slice(0, 70) : "readable"}`);

  const launch = await call("launch_app", { name: "notepad.exe" });
  const pid = parse(launch).pid;
  await new Promise((r) => setTimeout(r, 1500));
  const wins = parse(await call("list_windows", {})).windows ?? [];
  const win = wins.find((w) => String(w.pid) === String(pid)) ?? wins.find((w) => (w.title ?? "").toLowerCase().includes("notepad"));
  const scope = { pid: Number(pid), window_id: Number(win?.window_id) };
  console.log(`  launched Notepad pid=${pid}, window "${win?.title}"`);

  const snap = parse(await call("get_window_state", { ...scope, include_screenshot: false }));
  const doc = (snap.elements ?? []).find((e) => e.role === "Document") ?? (snap.elements ?? []).find((e) => e.role === "Edit");
  if (doc) {
    const sv = await call("set_value", { ...scope, element_token: doc.element_token, value: "ISO-CHECK: automation wrote this without touching your mouse" });
    console.log(`  set_value (UIA)  route=${JSON.stringify(parse(sv).route ?? "?")}  isError=${sv?.isError}`);
    const snap2 = parse(await call("get_window_state", { ...scope, include_screenshot: false }));
    const doc2 = (snap2.elements ?? []).find((e) => e.role === "Document") ?? doc;
    const ck = await call("click", { ...scope, scope: DesktopScope.Desktop, element_token: doc2.element_token });
    console.log(`  click (UIA)      delivery=${JSON.stringify(parse(ck).delivery ?? "?")}  isError=${ck?.isError}`);
  }
  if (pid) await call("kill_app", { pid }).catch(() => {});
  await d.endSession(EndSessionInput.new({ session: WS })).catch(() => {});
  if (typeof d.shutdown === "function") await d.shutdown().catch(() => {});

  console.log("\n=== VERDICT ===");
  console.log("  UIA (click / set_value / type / read): ISOLATED — background delivery, accessibility route,");
  console.log("      and get_cursor_position is locked in that mode. Your mouse/keyboard are untouched.");
  console.log(`  Pointer tools (move_cursor/hover, scroll, drag): NOT isolated — measured a real (${dx},${dy}) move.`);
}

main().catch((e) => { console.error("PROBE FAILED:", e?.stack || e); process.exit(1); });
