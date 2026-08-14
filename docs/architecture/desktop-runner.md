# Desktop Runner Architecture

How the Desktop Surface executes, and where its code lives. The decision behind this shape is [ADR-0001](../adr/0001-desktop-execution-surface.md); the measurements behind it are in [the cua-driver findings](../research/cua-driver-windows.md).

Read `runner.md` first — it describes the Web Surface runner, and everything here is defined by contrast with it.

## The Surface union

`RunnerActionRuntime` currently names the browser directly:

```ts
// electron/backend/runtime/runnerActionExecutors.ts — today
export type RunnerActionRuntime = {
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  // ...
};
```

It becomes surface-agnostic, with the surface carried as a discriminated member:

```ts
export type ExecutionSurface =
  | { kind: "web"; context: BrowserDriverContext; page: BrowserDriverPage }
  | { kind: "desktop"; driver: DesktopDriverClient; binding: WindowBinding };

export type RunnerActionRuntime = {
  surface: ExecutionSurface;
  // ...everything else unchanged
};
```

The existing generic parameter on `RunnerActionExecutorDependencies<Runtime>` is kept. It exists so flow-control callbacks can round-trip the runner's richer state without widening what an executor body may read, and that property matters more once two surfaces share the type.

**Executors narrow once, at entry.** A web executor opens with a `surface.kind === "web"` assertion and works with `surface.page` thereafter; a desktop executor does the mirror. No executor branches on surface mid-body — an action that would need to belongs to neither family.

Dependencies that take `page` directly (`pressKeyHuman(page, …)`, `pressHotkeyHuman(page, …)`) move behind the surface or into the web executor module, because there is no desktop value to pass them.

## Desktop execution model

The Web Surface holds a live `page` for the whole run. The Desktop Surface cannot: element addresses are valid only inside the Element Snapshot that produced them, and the driver rejects addresses that do not carry their snapshot.

Every element-addressed desktop action therefore runs the same cycle:

```
resolve Window Binding  →  take Element Snapshot  →  resolve Desktop Locator
                        →  act  →  verify with verify_state
```

Three consequences follow, and they are not optional:

1. **A snapshot per action.** Snapshots cannot be cached across actions, because `element_token` embeds the `snapshot_id` and stale tokens are rejected. Snapshots taken with `include_screenshot: false` are the cheap path and are what actions use.
2. **Verification replaces the return value.** `isError` has been observed both `true` and `false` for the same successful click, once carrying the Win32 success text `"The operation completed successfully. (0x00000000)"`. Desktop actions confirm their effect through `verify_state` and treat its verdict as authoritative.
3. **Degradation is detected, not assumed.** Each snapshot reports `degraded`, `degraded_reason` and `escalation.recommended`. The runner records the Capability Tier per action and fails with a specific error when an Element-addressed action meets a window that has dropped to Pixel.

## Process model

`cua-driver` raises Rust panics that terminate the host process. It runs in a **dedicated Electron utility process**:

```
Electron main
  └─ utility process: desktop driver host
       └─ @trycua/cua-driver (Embedded mode)
```

- The host owns one `CuaDriver` instance and the Driver Session.
- The backend talks to it over the utility process message port with a typed request/response envelope.
- A panic kills only the host. The active run fails with a clear error; the app survives and can restart the host for the next run.
- The host is started lazily on the first desktop run and stopped when no desktop run is active.

This is an availability boundary, not a security one. The driver has the operator's full privileges either way.

## Code layout

The current tree puts the browser driver in `browser/` and mixes surface-independent control flow with browser dispatch inside `runtime/`. With two surfaces that stops being legible, so surfaces become explicit siblings:

```
electron/backend/
  runtime/                    surface-independent ONLY
    runner.ts                 dispatch loop, cancellation, tracing
    runManager.ts             run lifecycle, locks, timeouts, persistence
    surface.ts                the ExecutionSurface union
    controlFlow/              loops, branches, routers, retries, variables
  surfaces/
    web/                      everything Playwright-shaped
      sessionManager.ts       (moved from backend/browser/)
      fonts.ts
      localEnvironment.ts
      executors/              web action executors
    desktop/
      driverHost.ts           utility-process entry point
      driverClient.ts         typed layer over cua-driver
      windowBinding.ts        Desktop Target -> (pid, window_id)
      locator.ts              Desktop Locator resolution
      snapshot.ts             Element Snapshot handling and tiering
      executors/              desktop action executors
  actions/
    registry.ts               both families, one registry
    execution.ts
    validation.ts
    schemas/
      web/                    the existing 108 schemas, moved
      desktop/                new
```

Rules that keep the split honest:

- `runtime/` imports from neither `surfaces/web/` nor `surfaces/desktop/`. It knows the union, not its members.
- `surfaces/web/` and `surfaces/desktop/` never import each other.
- `actions/registry.ts` stays single. It is the one place both families meet, and its `assertActionExecutorCoverage()` and `assertSchemaCoverage()` are what make a missing desktop executor or schema a build failure rather than a runtime surprise.

The moves under `surfaces/web/` and `actions/schemas/web/` are pure relocations. They are mechanical, they touch many import paths, and they should land as their own commit with no behavioural change, separate from anything desktop.

## Splitting the executor module

`runtime/runnerActionExecutors.ts` is **2923 lines** against the 500-line cap in `AGENTS.md`. It is pre-existing debt, but the surface union threads through it, so the desktop work forces it open.

Split along the **existing `owner` field** in `actions/registry.ts` (`navigation`, `element_interaction`, `form`, `keyboard`, `capture`, `browser_context`, `variables`, `network`, `advanced`, `graph_internal`) rather than inventing a new axis. That axis already classifies every action, the registry already enforces coverage against it, and it makes the web/desktop cut fall out naturally: `graph_internal` and `variables` are surface-independent and move to `runtime/controlFlow/`; the rest are web-owned and move to `surfaces/web/executors/`.

Sequence — each step is separately reviewable:

1. **Split only.** Move executor bodies into per-owner modules. No behaviour change, no signature change; existing tests must pass untouched.
2. **Lift control flow.** Move the surface-independent owners into `runtime/controlFlow/`, proving by compilation that they never referenced `page`.
3. **Introduce the union.** Change `RunnerActionRuntime` to carry `ExecutionSurface`; web executors narrow at entry. Still no desktop code.
4. **Add the desktop family.** New executors, new schemas, new registry entries.

Steps 1 and 2 are pure refactors and carry the risk; step 3 is where the type system does the work. Do not merge them into one change.

`runtime/testSupport/executorFixtures.ts` is deliberately named outside the `*.test.ts` pattern so it is type-checked against the real runtime shapes. Preserve that property — it is what will catch the surface union breaking a fixture.

## Belongs here

- Desktop driver host lifecycle, Window Binding, Element Snapshot handling, Desktop Locator resolution, tier detection and escalation reporting.

## Does not belong here

- Browser session or profile behaviour (`runner.md`).
- Control-flow semantics — shared, and surface-independent by construction.
- SQL persistence, IPC payload naming, UI polling.
