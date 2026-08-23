# ADR-0001: Manual IPC registration guarded by a type-level contract

Date: 2026-08-23 · Status: Accepted

## Context

Every backend command crosses four hand-written places:

1. `electron/ipc.ts` — channel-name map (~130 entries),
2. `electron/preload.cts` — one forwarder method per command,
3. the owning feature's `*Commands.ts` handler,
4. `electron/ipcContract.ts` — compile-time assertions that all four agree,
   plus the `InternalOnlyCommand` allowlist.

Adding one command therefore touches four files. The friction is real and
recurring: git history shows ~33 commits touching `preload.cts` and ~30 touching
`ipc.ts`. Generating channel names, forwarders, and contract assertions from the
handler map would collapse this to one place.

## Decision

Keep manual registration. Do not generate the bridge.

The correspondence is enforced by `ipcContract.ts` at compile time (Exclude-based
assertions over the channel map, handler map, and preload bridge), so drift fails
the build rather than shipping. This was deliberately established in commit
`1bb21efa` ("state the IPC command-list contract at the type level") and was
re-affirmed during the 2026-08 architecture review.

## Reasons

- The type-level guard converts the failure mode from "silent runtime mismatch"
  to "compile error", which removes the main safety argument for generation.
- Generation adds a build step to the Electron main/preload pipeline and an
  abstraction layer over ~130 thin forwarders whose bodies are one line each.
- Command additions are infrequent relative to other work; the marginal cost of
  four mechanical edits is accepted in exchange for zero magic.

## Consequences

- Adding a command = edit 4 files; CI/typecheck catches omissions.
- Future reviews should not re-propose bridge generation unless command-add
  frequency rises materially or the forwarders grow logic beyond one-line
  delegation. Revisit trigger: >~10 new commands per month sustained.
- The underscore-prefixed internal handlers (`_startWorkflowRun`,
  `_validateWorkflowRun`, …) stay out of the public bridge via
  `InternalOnlyCommand`.
