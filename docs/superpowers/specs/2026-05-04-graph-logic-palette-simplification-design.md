# Graph Logic Palette Simplification Design

## Status

Approved by the user on 2026-05-04.

This spec simplifies the user-facing `Add Logic` palette. It changes which graph
logic nodes are visible for new authoring, while preserving runtime and saved
graph compatibility for advanced nodes.

## Problem

The current `Add Logic` palette exposes many nodes at once:

- Branching: `If`, `Switch`
- Loops: `Repeat Times`, `Repeat For Each`, `While`, `Repeat Until`
- Recovery: `Retry`, `Try/Catch`, `Fallback`
- Flow Control: `Break Loop`, `Continue Loop`, `Stop Workflow`
- Safety: `Manual Approval`, `Rate Limit`, `Domain Allowlist`

This is too much for normal workflow authoring. Several nodes are either advanced
programming concepts, policy-like controls, or better placed in another palette:

- `Break Loop` and `Continue Loop` only make sense inside loop branches.
- `Try/Catch` and `Fallback` are advanced recovery constructs and overlap with
  easier `Retry` mental models.
- `Stop Workflow` belongs with terminal/end controls, not general logic.
- `Manual Approval`, `Rate Limit`, and `Domain Allowlist` are not core logic
  authoring controls for the current product surface.

## Goals

- Reduce cognitive load in `Add Logic`.
- Keep visible logic nodes focused on common workflow authoring.
- Move loop-control nodes into the `Loops` group where their context is clearer.
- Remove `Flow Control` and `Safety` groups from the main logic palette.
- Hide `Try/Catch` and `Fallback` from user-addable logic palettes for this
  phase.
- Preserve backend, compiler, runner, and saved graph compatibility.

## Non-Goals

- Do not delete graph node types from TypeScript or Rust in this change.
- Do not remove support for saved graphs that already contain hidden nodes.
- Do not change loop, retry, try/catch, fallback, safety, or stop runtime
  semantics.
- Do not design a full advanced-logic drawer or command palette in this spec.
- Do not change the previously approved decision that `Stop Workflow` belongs in
  `Add End`.

## Approved Decisions

- Move `Break Loop` and `Continue Loop` into the `Loops` group.
- Hide `Try/Catch` from the main `Add Logic` palette.
- Hide `Fallback` from the main `Add Logic` palette.
- Remove the `Flow Control` group.
- Remove the `Safety` group.
- Keep hidden nodes renderable and editable when loaded from existing saved
  graphs.

## Palette Design

The main `Add Logic` palette should expose these groups:

### Branching

- `If`
- `Switch`

`If` remains the primary branching tool. `Switch` remains visible because it is a
direct extension of branching and is easier to understand than nested recovery or
free-form loop controls.

### Loops

- `Repeat Times`
- `Repeat For Each`
- `While`
- `Repeat Until`
- `Break Loop`
- `Continue Loop`

`Break Loop` and `Continue Loop` should sit in `Loops` because they are only
valid inside loop bodies. Their descriptions should make that dependency clear:

- `Break Loop`: exit the current loop and continue after the loop.
- `Continue Loop`: skip the rest of the current loop body and move to the next
  iteration.

If validation detects either node outside a loop body, current behavior should
continue to block run with a clear error.

### Recovery

- `Retry`

`Retry` remains visible because it is the most common recovery node for browser
automation flakiness.

`Try/Catch` and `Fallback` should be hidden from the main palette for now. They
remain supported for existing graphs and future advanced surfaces.

## Removed Main Palette Groups

### Flow Control

Remove this group from `Add Logic`.

Its previous contents should be handled as follows:

- `Break Loop`: move to `Loops`.
- `Continue Loop`: move to `Loops`.
- `Stop Workflow`: keep out of `Add Logic`; expose through `Add End` according
  to `2026-05-03-graph-toolbar-palette-simplification-design.md`.

### Safety

Remove this group from `Add Logic`.

Its previous contents should be hidden from the main logic palette:

- `Manual Approval`
- `Rate Limit`
- `Domain Allowlist`

These nodes remain compatible when loaded from existing graphs. A later design
may decide whether they belong in an advanced palette, workflow settings, action
palette, or a dedicated guardrails surface.

## Existing Graph Compatibility

Saved graphs may already include hidden nodes:

- `try_catch`
- `fallback`
- `manual_approval`
- `rate_limit`
- `domain_allowlist`
- `stop_workflow`

These nodes must still:

- render on the canvas,
- show inspector fields,
- save,
- validate,
- compile,
- run where currently supported.

The simplification only changes the add palette. It does not remove graph
capabilities from persisted data.

## Documentation Updates During Implementation

When implementation changes are made, update:

- `docs/domain/workflow-lifecycle.md` for the visible `Add Logic` groups.
- `docs/domain/user-visible-invariants.md` for user-facing graph authoring
  controls.
- `docs/architecture/frontend.md` for palette ownership.
- `docs/contracts/workflow-types.md` if it lists user-addable graph nodes.
- `README.md` smoke checklist for the updated logic palette.

Docs should explain that `Break Loop` and `Continue Loop` are loop-only controls
and normally pair with an `If` inside a loop branch.

## Testing

Implementation should add or update focused frontend tests:

- `Add Logic` no longer renders `Flow Control`.
- `Add Logic` no longer renders `Safety`.
- `Loops` includes `Break Loop` and `Continue Loop`.
- `Recovery` includes `Retry` and does not include `Try/Catch` or `Fallback`.
- `Stop Workflow` is not addable from `Add Logic`.
- Existing saved graphs containing hidden nodes still render and expose
  inspector fields.

Required checks during implementation:

- Focused Vitest tests for edited graph palette behavior.
- `npx tsc --noEmit` if TypeScript props or types change.
- `npm test -- src/AppCss.test.ts` if styling invariants change.

## Acceptance Criteria

- The visible `Add Logic` palette has no `Flow Control` group.
- The visible `Add Logic` palette has no `Safety` group.
- `Break Loop` and `Continue Loop` are available from `Loops`.
- `Try/Catch` and `Fallback` are not available from the main `Add Logic`
  palette.
- Hidden nodes remain compatible when present in saved graphs.
- No Rust graph compiler or runner contract changes are required.

## Self-Review

- No placeholders remain.
- The spec distinguishes hiding from deleting graph capabilities.
- The scope is independent from power-user graph editing and toolbar
  simplification specs.
- Runtime semantics stay unchanged.
