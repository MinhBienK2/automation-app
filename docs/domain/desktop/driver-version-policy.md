# `cua-driver` version policy

How the Desktop Surface pins, verifies and upgrades `@trycua/cua-driver`. This
was the last item [ADR-0001](../../adr/0001-desktop-execution-surface.md) left
open: the ADR pinned `0.19.3` but named no upgrade rule.

## Why a policy at all

`@trycua/cua-driver` is not an ordinary dependency:

- It ships a **native `.dll` / `.node`** and reaches the driver through Rust FFI
  (`@ubjs/core`). A wire-format change is invisible to `tsc` — the whole typed
  layer in `surfaces/desktop/driverClient.ts` is hand-written against
  `callTool(name, argumentsJson)`, and a renamed field or renumbered enum
  compiles clean and fails only at run time, on a real desktop.
- A missing required field raises a **Rust panic that kills the host process**,
  not a typed error. This is why the driver runs in a utility process — but a
  version bump that adds a required field turns a working call into a panic.
- Its release cadence is high (16 releases in three weeks at the time of #39)
  and it carries a **prerelease dependency** (`@ubjs/core@0.31.0-3`).

So the version is pinned **exactly** (`"@trycua/cua-driver": "0.19.3"`, no
`^`/`~`), and it is upgraded deliberately, never by a range resolver.

## The rule

1. **Pin exactly.** The dependency stays a fixed version. Dependabot's
   npm-minor-and-patch group must not widen it; if a bump PR touches this
   package, it is reviewed under this policy, not merged as routine.
2. **No upgrade lands without a real-driver run.** `scripts/desktop-smoke.mjs`
   is the gate. It launches the real driver on Windows 11 and exercises every
   tool the surface wraps — launch, `get_window_state`, `verify_state`,
   clipboard round-trip, scroll, drag, `move_cursor`, and both session scopes.
   A green unit suite is **not** sufficient: the fakes share the code's
   assumptions and cannot falsify a wire-format change (the lesson of #39).
3. **Re-confirm the measured invariants** on every upgrade, because each is a
   thing that compiled clean while wrong before it was measured:
   - Enum encodings over `callTool`: `ScrollDirection {up:0,down:1,left:2,right:3}`,
     `DesktopScope.Desktop=0`, `CaptureScope {Auto:0,Window:1,Desktop:2}`.
   - The session capture-scope rule: `get_window_state` is disabled in a
     desktop-scope session; the host pins `CaptureScope.Window`.
   - `pid` / `window_id` are integers on the wire; `isError` is not trusted.
   - Only `Embedded` mode is reachable from npm.
   Any change to these is a breaking change to `driverClient.ts`, and the maps
   in that file plus `driverHost.ts` are where the one-line fixes live.
4. **Record the run.** Note the driver version and the smoke result in the
   upgrade PR, the way #39 recorded `docs/research/cua-driver-windows.md`.

## When to upgrade

Pull a new version for a fix or a tool the surface needs (a typed element-token
scroll, say, would let `desktop_scroll`/`desktop_drag` drop their frame-centre
step). Do not upgrade to stay current — a driver release invalidates nothing in
a stored workflow, because saved graphs carry the domain shapes, never the
driver's wire format. There is no standing cost to lagging, and a real cost to
every bump: another Windows 11 run.
