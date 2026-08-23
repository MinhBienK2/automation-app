# cua-driver on Windows — hands-on findings

Evidence base for the desktop automation effort ([map #38](https://github.com/MinhBienK2/automation-app/issues/38)).
Every number here was measured on a real machine, not read from documentation.

- **Package**: `@trycua/cua-driver@0.19.3` (MIT, npm, SLSA provenance)
- **Host**: Windows 11 Pro 10.0.26200, Node v22.17.0, 1920x1080 @1x
- **Tickets**: [#39](https://github.com/MinhBienK2/automation-app/issues/39) (verification), [#49](https://github.com/MinhBienK2/automation-app/issues/49) (UIA collapse)

## Verdict

Viable. The core requirement — drive native apps **without taking over the physical mouse or keyboard** — is real and measured. One narrow defect (UIA collapse on ApplicationFrameHost-hosted apps) is a documented limitation rather than a blocker.

## Install

```
npm install @trycua/cua-driver     # 4s, 5 packages, 0 vulnerabilities
```

25 MB on disk: `cua_driver_sdk.dll` (22 MB) + `cua_driver_node_runtime.node` (602 KB), pulled via the platform-specific optional dependency `@trycua/cua-driver-win32-x64-msvc`. Only the host platform's binary is fetched, so a packaged build ships one platform's binary.

No administrator rights, no UAC prompt, no separate installer. Elevated windows (UIAccess) were **not** exercised.

## Input isolation works

Measured with `getCursorPosition()` before and after an element click on Calculator:

```
cursor BEFORE: {"x":1612,"y":661}
click Seven:   isError=false
cursor AFTER : {"x":1612,"y":661}
```

The physical cursor does not move. `cua-driver` renders an agent cursor overlay instead of driving the hardware pointer. `launch_app` likewise reports launching "in background" without stealing focus.

## Execution modes — only one is reachable from npm

`DriverExecutionMode` has four values: `Embedded=0`, `Daemon=1`, `PrivateWorker=2`, `Remote=3`.

| Constructor | Mode | Reachable from npm? |
|---|---|---|
| `CuaDriver.create()` | `Embedded` — same process, no IPC | ✅ yes |
| `CuaDriver.createPrivateWorker()` | `PrivateWorker` — separate process, stdio | ❌ needs `binaryPath` to a standalone `.exe` |
| `CuaDriver.connect()` | `Daemon` — socket | ❌ needs an installed daemon |

The platform package contains only `.dll` and `.node` — **no executable**. Process isolation therefore requires installing the standalone driver separately, outside npm.

### A missing field panics the process

```js
await d.typeText({ text: "hello" });   // omits the required `scope` field
```

```
RustPanic [Error]
    at CuaDriver.typeText (.../cua_driver_sdk.js:2922:41)
```

A missing required field raises a **Rust panic that terminates the Node process**, not a typed error. In `Embedded` mode inside Electron's main process this would take down the whole application along with any in-flight run. This is the primary driver of the process-model decision in [ADR-0001](../adr/0001-desktop-execution-surface.md).

## API surface: 54 tools, 23 typed

`listToolsJson()` reports **54 tools**; only **23** have a typed method on `CuaDriver`. The remaining **31 are reachable only through `callTool(name, argumentsJson)`** with hand-written JSON and hand-written types.

Untyped — and load-bearing for this project:

```
list_apps  list_windows  get_window_state  get_accessibility_tree
launch_app  kill_app  bring_to_front  set_value  double_click  right_click
check_permissions  start_recording  stop_recording  replay_trajectory
```

The split runs the wrong way for our purposes. The typed `ClickInput` is `{x, y, scope, button?, count?}` — **pixel coordinates only**. Element-addressed clicking, which is the entire basis of deterministic replay, exists only on the untyped path.

Other integration details:

- `pid` and `windowId` are `bigint`.
- Every method accepts `asyncOpts_?: { signal: AbortSignal }` — a direct match for the existing runner's `AbortSignal` cancellation.
- `DesktopScope` has exactly one value (`Desktop = 0`) but is mandatory; omitting it panics (above).
- `get_window_state` requires **both** `pid` and `window_id`. Error messages are precise and actionable.
- `get_accessibility_tree` does **not** return an element tree despite the name — it lists processes and windows.

## Element shape

```json
{"depth":4,"element_index":27,"element_token":"s00000001:27","enabled":true,
 "frame":{"h":63,"w":97,"x":4,"y":405},"label":"Seven","role":"Button","parent_index":1}
```

- `element_token` is `<snapshot_id>:<index>` — **scoped to one snapshot, not durable across runs**.
- Bare `element_index` is rejected: *"bare element_index is not accepted in Cua Driver 0.17; pass element_token or snapshot_id with element_index"*.
- Every `get_window_state` mints a new `snapshot_id`, so **a fresh snapshot is required before each element action**.
- `parent_index` is present, so ancestry is available directly rather than inferred from `depth`.
- A `value` field carries element content — see [the leak](#the-accessibility-tree-leaks-secrets-as-text).

## Capability tiers are built in

Responses carry their own degradation signal, so we consume it rather than building our own detector:

```json
"degraded": true,
"degraded_reason": "ax_tree_empty: the UIA walk returned no actionable elements. The window may be
                    a non-UIA surface (canvas/WebGL/custom-drawn) or its accessibility tree was
                    not ready (Chromium/Electron require a UIA-enable + settle).",
"escalation": { "reason": "non-AX surface — act by pixel (x,y)...", "recommended": "px" }
```

### Toolkit does not predict tier

The intuitive ranking (native Win32 best, Electron worst) is **wrong** on this machine:

| App | Toolkit | Elements on first read |
|---|---|---|
| File Explorer | shell | **410** |
| Paint | Store-packaged | **92** |
| Notepad | Store-packaged | 35 |
| Character Map | classic Win32 | 15 |
| Antigravity IDE | Electron | 3 (window chrome only) |
| Claude | Electron | 3 (window chrome only) |
| Settings | UWP / WinUI | **0 — degraded** |

Electron apps expose their window chrome without any flag but report `elements_complete: false`; their content needs the UIA-enable and settle described in `degraded_reason`. Settings exposes nothing at all. Tier is a property of **the individual window's UIA provider**, not of the toolkit — so it must be probed per target, never assumed.

## The UIA collapse defect

Reading a window's tree repeatedly can permanently destroy that window's UIA provider.

### Reproduction

`get_window_state` five times against Calculator, **no clicks, no other actions**:

```
#1 snapshot=s00000001 els=34  degraded=false
#2 snapshot=s00000002 els=34  degraded=false
#3 snapshot=s00000003 els=0   degraded=true   ax_tree_empty
#4 snapshot=s00000004 els=0   degraded=true
#5 snapshot=s00000005 els=0   degraded=true
```

Not caused by clicking, not fixed by delay (1200 ms between reads), not fixed by `include_screenshot: true`, and not fixed by an explicit session (`start_session({captureScope: Window})` reports `active: true`, `effectiveScope: Window` — and collapses identically).

### The damage is in the target, not the driver

```
after collapse, DIFFERENT window, SAME driver:   explorer  els=70   ✅ driver fine
after collapse, SAME window, NEW driver:         calc      els=0    ❌ window dead
after collapse, kill + relaunch Calculator:      calc      els=0    ❌ still dead
```

A brand-new `CuaDriver` instance cannot read the window, and the damage **survives restarting the application**. Something shared and longer-lived than the app process holds the broken state; `ApplicationFrameHost.exe` — the shared host for UWP windows — is the prime suspect, unconfirmed.

### Scope: narrow

Twelve consecutive reads per app, each launched fresh by the probe:

| App | Kind | Elements | Good reads |
|---|---|---|---|
| `charmap` | classic Win32 | 15 | **>12** |
| `mspaint` | Store-packaged | 92 | **>12** |
| `explorer` | shell | 410 | **>12** |
| `calc` | UWP / WinUI | 0 | **0** (already destroyed by earlier probes) |

Explorer sustained twelve reads of a 410-element tree with no degradation. The defect is confined to UWP windows hosted by `ApplicationFrameHost`; classic Win32, Store-packaged, and shell windows are unaffected.

### Consequence

Because the API demands a fresh snapshot per element action, an affected app supports roughly two element actions before its tree is gone — and it does not recover. Unaffected apps have no such limit.

This is a **documented limitation with a runtime detection path** (`degraded` / `escalation`), not a blocker. See [capability tiers](../domain/desktop/capability-tiers.md) for how the product surfaces it.

## The accessibility tree leaks secrets as text

`get_window_state` returns a `value` field per element. For a text editor, the `Document` element's `value` is **the entire contents of the open file**.

During probing, `launch_app({name:"notepad"})` restored the operator's previous tabs and the tree returned the full contents of a file holding live credentials — as plain text in `structuredJson`, with no screenshot involved.

This matters because the existing evidence model redacts by **key pattern**, which cannot see inside a `Document`'s `value`. Any redaction policy must cover the tree, not only screenshots. See [secrets and evidence](../domain/desktop/secrets-and-evidence.md).

## Behaviours worth keeping

- `launch_app` returns a `windows` array with `bounds` and `window_id` — no separate lookup needed.
- `kill_app` enforces provenance: *"standard mode may terminate only a process proven to have been launched by this Cua runtime."* A driver instance cannot kill processes it did not start.
- **`launch_app` is not clean-slate**: launching Notepad restored the operator's previous tabs. Application state persists independently of us.
- `set_value` sets a control's value directly, avoiding per-character typing.
- `start_recording` / `stop_recording` / `replay_trajectory` exist, which makes a desktop recorder considerably cheaper than assumed when it was ruled out of scope.
- `verify_state` accepts `expect: Array<StatePredicate>` (1–8, ANDed) — a way to confirm an action's effect instead of trusting its return value.

## Second session: what the wire actually looks like

Everything above came from probing the SDK. The section below came from running
Mission Control's own client against it for the first time (#48), and it is
mostly a list of things the client had inferred and got wrong. None of them
could have been caught by a test, because every test had been written against
the same inference.

**The package is ESM-only.** `createRequire(...)("@trycua/cua-driver")` raises
`ERR_PACKAGE_PATH_NOT_EXPORTED`: `"type": "module"`, and the exports map
declares only an `import` condition. The driver host must use dynamic `import()`.

**`startSession` needs a session id, and a numeric scope.**
`StartSessionInput.session` is required — passing `undefined` fails inside the
native bridge with *"The `src` argument must be of type string"*, which names
nothing. `captureScope` is the enum `{Auto: 0, Window: 1, Desktop: 2}`; the
string `"Window"` is not accepted.

**`asyncOpts` must be omitted, not passed as `{signal: undefined}`.** The
generated wrapper reads `asyncOpts?.signal.aborted` — optional on the options,
not on the signal — so every call made without a run signal threw inside
`@ubjs/core` before reaching the tool.

**`structuredJson` is a string of JSON**, not an object. Reading it directly
hands every caller a string where it expected a record.

**Ids must be integers on the wire.** They arrive as `bigint` and are stored as
strings — `JSON.stringify` refuses bigint — but sending the string back is
refused: *"Missing required integer field pid."*

**`degraded` rides the envelope, not the payload.** A healthy
`get_window_state` payload has no `degraded` or `escalation` key at all.

**The screenshot is an envelope attachment.** `include_screenshot: true` puts
`{mimeType, dataBase64}` in `images[]`; the payload carries only
`screenshot_width`, `screenshot_height` and `screenshot_mime_type`. Every
guessed payload field name was wrong.

**`verify_state` predicates are not a tagged union.**

```
expect: [{ window: { exists: true } }]
expect: [{ element: { selector: { role: "Button", label_contains: "Save" }, exists: true } }]
```

`{kind: "window_exists"}` is rejected with *"unknown field `kind`, expected
`window` or `element`"*, and `labelContains` with *"expected `role` or
`label_contains`"* — the wire is snake_case throughout. The verdict comes back
as `status: "satisfied" | "unsatisfied" | ...` on the payload, and again as a
typed `verification` record on the envelope. The selector is **weaker than a
Desktop Locator**: role and a label substring, no ancestry, no ordinal, no
automation id.

**Window entries and element frames use different rectangles.** A window's
`bounds` is `{x, y, width, height}`; an element's `frame` is `{x, y, w, h}`.
`launch_app`'s window entries carry **no pid** — the pid belongs to the launch —
and the sort key is `z_index`, not `z_order`.

**`tree_markdown`.** `get_window_state` returns the whole tree a second time as
38 KB of markdown, beside the structured `elements`. The driver's own `_note`
says to prefer `elements`. It is a second copy of the same leak the tree is:
`secrets-and-evidence.md` was written before anyone had seen this field.

**A missing required field did not panic.** `type_text` without `pid` returned
`isError: true` and the process survived, as did `verify_state` with an empty
`expect`. That does not disprove the panic measured in #39 — it was seen once,
on a different field — but the risk is smaller than that finding implied, and
the utility process is now insurance rather than a necessity.

## The thin slice, end to end

Character Map (classic Win32, 15 elements, tier Element), driven through the
real runner and the real client — not a probe.

```
run 1  success  4.9s  typed="omega"  verdict="reached shared control flow"
run 2  success  4.2s  after the app was closed, reopened and resized to 520x700
```

Six steps: click an element, type into it, read the text back, photograph the
window, compare with `check_text_contains`, branch on the result with
`if_condition`. The last two are surface-independent executors that take a
`VariableScope` and **could not reach a page if they tried** — which is the
evidence for the map's constraint #4 that no amount of documentation provides.

The screenshot landed at `runs/<id>/screenshots/004-shot-window.png` and was
recorded as an evidence item.

**The cursor does not move.** Five consecutive runs, position read from outside
the driver with `System.Windows.Forms.Cursor`:

```
run 1..5   1368,390 -> 1368,390   no movement
```

A single earlier run showed movement and was not reproducible in five attempts,
on a machine with a person sitting at it. The click's own report explains why
there should be none: `route: "accessibility"`, `delivery: {mode: "background"}`
— a UIA Invoke or a `PostMessage`, never synthetic input to the desktop.

**A locked workstation changes nothing.** The same slice on a loop across a
lock and an unlock, with `LogonUI.exe` as the lock signal:

```
07:32:29 unlocked  success  omega
07:32:34 locked    success  omega     <- Win+L here
...      locked    success  omega     (13 consecutive runs, no failures)
07:33:38 locked    success  omega
```

The lock screen is a separate desktop (`Winlogon`); the application's window is
still on the user's own desktop underneath it, and UIA reads the window rather
than the screen. This settles the question `scheduling.md` left open: overnight
scheduling is viable. Signed-out and restarted machines were not tested, and
are a different question.

## Unresolved

1. **`isError` is unreliable.** The same element click returned `isError=true` with the text `"The operation completed successfully. (0x00000000)"` — a Win32 success code surfaced as failure — and `isError=false` on another run. Conditions not isolated. Treat `verify_state` as the source of truth.
2. **Elevated windows / UIAccess** untested.
3. **`elements_complete: false`** on otherwise healthy snapshots — meaning and remedy unknown.
4. **Maturity.** 16 releases in three weeks (0.11.0 on 2026-07-22 → 0.19.3 on 2026-08-10), with a prerelease dependency `@ubjs/core@0.31.0-3`. Pin exactly and expect breaking changes.

## Reproducing

Probe scripts are throwaway and live outside the repo, in the session scratchpad under `cua-probe/`. The two that matter:

- `probe11.mjs` — consecutive reads showing the collapse
- `probe12.mjs` — per-window vs per-driver isolation of the damage
