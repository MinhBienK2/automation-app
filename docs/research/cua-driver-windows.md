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

## Unresolved

1. **`isError` is unreliable.** The same element click returned `isError=true` with the text `"The operation completed successfully. (0x00000000)"` — a Win32 success code surfaced as failure — and `isError=false` on another run. Conditions not isolated. Treat `verify_state` as the source of truth.
2. **Elevated windows / UIAccess** untested.
3. **`elements_complete: false`** on otherwise healthy snapshots — meaning and remedy unknown.
4. **Maturity.** 16 releases in three weeks (0.11.0 on 2026-07-22 → 0.19.3 on 2026-08-10), with a prerelease dependency `@ubjs/core@0.31.0-3`. Pin exactly and expect breaking changes.

## Reproducing

Probe scripts are throwaway and live outside the repo, in the session scratchpad under `cua-probe/`. The two that matter:

- `probe11.mjs` — consecutive reads showing the collapse
- `probe12.mjs` — per-window vs per-driver isolation of the damage
