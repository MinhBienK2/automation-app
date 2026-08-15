---
status: accepted
---

# Desktop automation is a second Execution Surface, not a second product

Mission Control drives browser pages today and must also drive native desktop applications. We are adding a **Desktop Surface** alongside the existing **Web Surface**: the two share the graph model, compiler, control-flow actions, evidence model, run lifecycle, persistence, and UI, and diverge below that into separate runners, separate action families, and separate Surface Drivers. A workflow belongs to exactly one surface and cannot mix the two. The driver runs in a **dedicated utility process**, never in the Electron main process.

## Why not extend the existing browser driver

`electron/backend/browser/sessionManager.ts` exposes `BrowserDriver`, `BrowserDriverContext`, `BrowserDriverPage` and `BrowserDriverLocator`. These look like a driver abstraction and are not one — they are Playwright's own shape under different names:

```ts
goto(url) · frameLocator() · evaluate(pageFunction) · addInitScript()
waitForLoadState() · setViewportSize() · route() · addCookies()
```

They successfully swap CloakBrowser for Camoufox only because both *are* Playwright. A native application window has no URL, no DOM, no frames, no cookies, and nothing to evaluate script against. Implementing `BrowserDriverPage` over `cua-driver` would produce an adapter whose majority of methods throw `unsupported`, and every caller would then have to know which half of the interface is real.

**We therefore forbid making the desktop driver implement any `BrowserDriver*` type.** The seam is raised one level instead: `RunnerActionRuntime` stops naming `context` and `page` directly and carries a discriminated Execution Surface. See [the runner architecture](../architecture/desktop-runner.md) for the resulting shapes.

## Why the graph layer is shared anyway

`docs/architecture/runner.md` records that graph-internal control actions — loops, branches, routers, retries, variable mutation, assertions — execute **above** the browser dispatch layer. They never touch `page`. That is the whole reason a shared foundation is affordable: the most expensive and most correctness-critical machinery in the runner is already surface-independent, and the Desktop Surface inherits it unchanged.

Duplicating it would mean two implementations of the same domain rules drifting apart, which makes debugging harder rather than easier — the opposite of the reason to separate.

## Why a separate process

Measured on Windows 11 ([findings](../research/cua-driver-windows.md)): omitting a required field from a `cua-driver` call raises a **Rust panic that terminates the host process**, rather than returning a typed error.

```
RustPanic [Error]
    at CuaDriver.typeText (.../cua_driver_sdk.js:2922:41)
```

`CuaDriver.create()` runs in-process (`Embedded` mode), so a panic inside Electron's main process would destroy the application, every in-flight run, and any unsaved state. `cua-driver`'s own out-of-process modes are not reachable from npm — the platform package ships a `.dll` and a `.node` but no executable, so `createPrivateWorker()` cannot be used without a second, separate installation.

We therefore host the driver in an **Electron utility process** that we own: it loads `@trycua/cua-driver` in `Embedded` mode, and a panic kills only that process. The run fails; the app survives and can restart the driver. This is an availability decision, not a security boundary.

**The panic did not reproduce when the slice ran** ([#48](https://github.com/MinhBienK2/automation-app/issues/48)). On the same pinned version, `type_text` without its required `pid` returned `isError: true` and the process lived, as did `verify_state` with an empty `expect`. The decision stands unchanged: it was measured once, on a different field, and a fault that kills the host is not something to design *out* of on one contrary observation. But the utility process is now insurance rather than a necessity, and that is worth knowing before anyone spends effort hardening it further.

## Why one surface per workflow

Allowing a single graph to mix web and desktop steps would require the runtime to hold both a live browser context and a live window binding, and every action would need to declare which it targets. The value is speculative and the cost is paid in every action config, every validation path, and every UI affordance. Workflows pick a surface at creation. If a genuine cross-surface use case appears later, the shared graph layer leaves the door open — the surface field becomes a set instead of a scalar.

## Consequences

- **~31 of `cua-driver`'s 54 tools are untyped.** Element-addressed clicking, `list_windows`, `get_window_state`, `launch_app` and `set_value` exist only behind `callTool(name, argumentsJson)`; the typed `ClickInput` is pixel-only. We own a hand-written typed layer over the untyped path, and it is the load-bearing one. It belongs in the desktop Surface Driver and nowhere else.
- **`runnerActionExecutors.ts` (2923 lines) must be split** before the surface union lands, because `page` is threaded through it. `AGENTS.md` caps files at 500 lines; this one is already six times over. See [the split plan](../architecture/desktop-runner.md#splitting-the-executor-module).
- **Action count grows the `ActionType` union.** Every action still needs a Zod schema (`assertSchemaCoverage()` fails the build otherwise) and an executor (`assertActionExecutorCoverage()` likewise). Desktop actions satisfy both through the same registry, gaining compile-time coverage for free.
- **The driver does not report success reliably.** `isError` has been observed both `true` and `false` for the same successful click, once carrying the text `"The operation completed successfully. (0x00000000)"`. Desktop actions confirm their effect with `verify_state` rather than trusting the return value.
- **Isolation is of input devices only.** The automation runs against the operator's real applications with their real logged-in state; it does not take over the mouse or keyboard, and it is not a sandbox. A desktop workflow can do anything the operator can.

## Considered and rejected

**Separate everything below the UI.** Own graph type, own compiler, own runner, own run table. Rejected: it duplicates loop, retry, branch and variable semantics, which then drift.

**Sandbox isolation via VM or container** (`lume`, QEMU, Docker, Windows Sandbox, cua cloud). Rejected: the applications worth automating carry the operator's existing logged-in state, and a sandbox is precisely what destroys that. Revisit only if the threat model changes.

**`cua-driver`'s LLM agent loop.** Rejected for now: a model in the loop removes the repeatability that the graph model exists to provide, and costs latency and money per step. We use `cua-driver` as a driver and ignore its agent.

**`cua-driver`'s `browser_*` tools.** Rejected: they duplicate CloakBrowser, which is more capable for our purposes and already integrated.

**Alternative drivers.** Appium plus WinAppDriver (no viable Linux driver, WinAppDriver effectively unmaintained), FlaUI via a .NET sidecar (Windows only), `nut.js` (drives the real cursor, violating the core requirement, plus licensing friction), direct per-OS accessibility bindings (three implementations to write and maintain). `cua-driver` is the only option that is cross-platform, background-by-design, and TypeScript-native. Its risk is maturity — 16 releases in three weeks — so the version is pinned exactly and the driver is confined behind our own typed layer, which is what makes replacing it tractable.
