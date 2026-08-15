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

### Most executors should never see a surface at all

[#32](https://github.com/MinhBienK2/automation-app/issues/32) measured what executors actually read, and the result changes the shape above for the better: the number, text, boolean, list, object, date, crypto, file and HTTP families **never touch the browser**, yet today each receives a live page and browser context. Five runtime fields are referenced zero times across the whole executor module.

So `surface` does not belong on the runtime every executor receives. It belongs on the **narrow interface only surface-acting executors ask for**:

```ts
type VariableScope     = { outputs; elementRefs; … };          // data-only actions
type SurfaceActing     = VariableScope & { surface: ExecutionSurface };
type FlowControlling   = VariableScope & { … };                // loops, retries, nesting
```

This is why the Desktop Surface is affordable. Adding a second surface costs nothing for the majority of executors, because they never referenced the first one. Only `SurfaceActing` executors split into web and desktop families.

Two consequences for anyone implementing this:

- **Do not add `surface` to the base runtime and then narrow everywhere.** That spreads the cost across executors that have no business knowing a surface exists, and it is precisely the shape #32 exists to remove.
- **#32 should land before the surface union**, not after. Doing it in the other order means threading `surface` through the very executors #32 is about to take it away from.

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
      types.ts                driver shapes and domain shapes, kept apart
      payloads.ts             leak-safe descriptions of driver payloads
      protocol.ts             the request/response wire, both halves
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

### What exists today

**The surface union has landed.** `runtime/surface.ts` holds `ExecutionSurface`, and `RunnerActionRuntime` carries `surface` instead of `context` and `page`. Web-acting families narrow once at their entry through `requireWebSurface`; `conditionMatches` is the one deliberate exception, because control flow calls it and a variable condition must not require a surface at all.

`#32` landed first, as sequenced: data-only and control-flow executors take a `VariableScope` and cannot reach a page. That is what made the union cheap — it touched the browser half only.

The driver-facing half of `surfaces/desktop/` is built and unit-tested with no driver present: `types.ts`, `payloads.ts`, `locator.ts`, `snapshot.ts`, `windowBinding.ts`, `driverClient.ts` and `protocol.ts`. Every one of them is pure or transport-injected, which is why they can be tested on Linux against payloads captured on Windows.

The run lifecycle is built and has run: `RunManager` opens a desktop surface for
a desktop workflow, `surfaceOpener.ts` adapts a Desktop Session into the
runner's `OpenedSurface`, the Desktop Target lock is held for the length of the
run, and `desktop_screenshot` writes an evidence artifact. A workflow's surface
is chosen at creation, the palette filters by it, and `ActionConfigDesktopFields`
plus the element picker are how a desktop step gets authored.

The slice ran on Windows 11 on 2026-08-15: six steps against Character Map,
twice, the second time after the application was closed, reopened and resized.
Numbers in [the research findings](../research/cua-driver-windows.md#the-thin-slice-end-to-end).

**Everything this section used to call unmeasured has now been measured, and
most of it was wrong.** `verify_state` takes `{window}`/`{element}` records
rather than a tagged union; the screenshot arrives as an envelope attachment
rather than a payload field; `structuredJson` is a string; ids must be integers
on the wire; the package is ESM-only, so the host's `createRequire` could never
have loaded it. The corrected shapes are in the research document, and the
lesson worth keeping is narrower than "measure early": *every test in this
directory passed against the inference*, because the tests and the client were
written from the same guess. Fakes cannot falsify an assumption they share.

Still not built:

- **`DesktopLaunchSpec.ready` is honoured only as a timeout.** `session.ts`
  polls `list_windows` until a window matching the selector appears, which is
  the `kind: "window"` condition; no other readiness condition exists to
  implement, and the timeout is the whole of the contract.
- **Opt-in Element Snapshot capture for debugging**, specified in
  `secrets-and-evidence.md`. It needs a per-step flag, a redaction pass over
  element values, and a place in the Explorer that reads as "debug", not
  "evidence".

The moves under `surfaces/web/` and `actions/schemas/web/` are pure relocations. They are mechanical, they touch many import paths, and they should land as their own commit with no behavioural change, separate from anything desktop.

## Splitting the executor module

`runtime/runnerActionExecutors.ts` is **2923 lines** against the 500-line cap in `AGENTS.md`. It is pre-existing debt, but the surface union threads through it, so the desktop work forces it open.

**This overlaps two tickets that already exist**, and they should be reconciled rather than duplicated:

- [#32](https://github.com/MinhBienK2/automation-app/issues/32) — split the runtime by what executors actually need. **Its axis supersedes an owner-based split.** "What does this executor read" is the cut that makes data-only executors testable with no browser and no temp directory, and it is the cut that makes a second surface nearly free.
- [#31](https://github.com/MinhBienK2/automation-app/issues/31) — make `ActionDefinition` the single home for per-action knowledge: schema, validator, executor, trace summary and presentation, one module per action type, exhaustiveness-checked at compile time.

File **grouping** can still follow the registry's `owner` field, because that axis already classifies every action and keeps directories legible. But the **interface** split is #32's, and the two are not the same decision: one is where code sits, the other is what a function may read.

Sequence — each step separately reviewable:

1. ~~**Land #32.**~~ Done. Narrow interfaces, one runtime shape declared once, in-memory browser driver exported for shared test use.
2. ~~**Lift control flow** into `runtime/controlFlow/`.~~ Done — and the compilation proof is stronger than planned: control flow takes a `VariableScope`, so it could not reference a page even if someone tried.
3. ~~**Introduce the union.**~~ Done. `ExecutionSurface` sits on `SurfaceActing`, not on the base runtime.
4. ~~**Add the desktop family.**~~ Done: ten actions, Zod schemas under `actions/schemas/desktop/`, executors under `surfaces/desktop/executors/`, all covered by the single registry.
5. ~~**Bind the surface to the workflow**~~ — persistence, the picker at creation, the palette filter — ~~then the run lifecycle: launch, bind, host, lock.~~ Done, and the slice ran against it.

Steps 1 and 2 carry the risk; step 3 is where the type system does the work. Do not merge them.

**Order matters.** Running step 3 before step 1 means threading `surface` through the same executors #32 then removes it from — wasted work that also makes #32's diff much harder to review.

`runtime/testSupport/executorFixtures.ts` is deliberately named outside the `*.test.ts` pattern so it is type-checked against the real runtime shapes. Preserve that property — it is what will catch the surface union breaking a fixture — and put #32's exported in-memory browser driver alongside it.

## Belongs here

- Desktop driver host lifecycle, Window Binding, Element Snapshot handling, Desktop Locator resolution, tier detection and escalation reporting.

## Does not belong here

- Browser session or profile behaviour (`runner.md`).
- Control-flow semantics — shared, and surface-independent by construction.
- SQL persistence, IPC payload naming, UI polling.
