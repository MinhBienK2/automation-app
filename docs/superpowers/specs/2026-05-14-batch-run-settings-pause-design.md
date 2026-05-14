# Batch Run Settings Pause Design

## Status

Approved for spec-only documentation on 2026-05-14.

## Problem

Workflow Settings currently shows three batch-related controls inside Run Policy:

- `Batch concurrency limit`
- `Batch runs are headless`
- `Stop batch on first failed row`

These controls describe real backend batch behavior, but the product does not yet
have a clear user-facing Batch Run workflow in the graph workspace. As a result,
operators can edit settings whose effect is not discoverable from the main UI.
The most confusing field is `Batch concurrency limit`: the backend rejects values
above `1` until row-level browser/session isolation is implemented, so exposing it
as an editable setting implies capability that does not exist yet.

## Goal

Pause the three batch controls in Workflow Settings until Batch Run is designed as
a first-class UI flow.

The UI should make clear that batch controls exist conceptually but are not
currently editable from Run Policy. Backend batch command compatibility should be
preserved.

## Non-Goals

- Do not remove `run_batch_workflow`.
- Do not remove batch fields from `WorkflowSettingsRunPolicy`.
- Do not change persisted settings, import/export, duplicate behavior, or backend
  batch command semantics.
- Do not implement a Batch Run UI, CSV import, row editor, mapping UI, result
  table, or parallel row isolation.
- Do not change normal workflow run behavior.

## Current Behavior

Backend:

- `run_batch_workflow` accepts `rows`, optional `concurrency_limit`, and optional
  `headless`.
- Each batch row is prepended as runtime variables through a generated
  `set_variable` setup step.
- Rows run sequentially.
- Values above `1` for concurrency are rejected.
- `batch_headless` is used as the default when the request omits `headless`.
- `batch_stop_on_first_failed_row` stops scheduling later rows after the first
  failed row.
- Batch row browser retention is forced closed by the command layer.

Frontend:

- Run Policy shows the three batch controls as normal editable fields.
- There is no obvious primary Batch Run entry point near the graph Run button.
- Help text explains the fields, but their placement makes them look like normal
  run settings.

## Proposed Behavior

In `Workflow Settings -> Run Policy`, render the three batch controls as paused:

- Keep the labels visible.
- Disable the input/switch controls.
- Preserve displayed saved values.
- Add a compact note near the group:
  `Batch controls are paused until Batch Run UI is ready.`

The disabled controls are informational only. They should not call
`onSettingsChange` while disabled.

The rest of Run Policy remains editable:

- `Max workflow duration ms`
- `Browser retention`

## UX Rationale

This reduces false affordance without deleting product direction.

Operators can still see that batch behavior is planned and has backend support,
but they are not encouraged to tune controls whose execution surface is not yet
available in the primary UI. Keeping the controls visible but disabled is better
than deleting them because it preserves context for existing settings and help
copy while making the current product boundary explicit.

## Backend Compatibility

No backend behavior changes are required.

The command layer should continue to:

- Accept `run_batch_workflow`.
- Apply saved `batch_headless` and `batch_stop_on_first_failed_row` values.
- Reject concurrency above `1`.
- Persist per-row run records and evidence.

This means existing automated callers and tests keep working. The pause only
affects user editing in Workflow Settings.

## Documentation Updates

Current docs should be updated when this is implemented:

- `docs/domain/workflow-lifecycle.md`: note that batch defaults are currently
  paused in the Settings UI while backend compatibility remains.
- `docs/domain/user-visible-invariants.md`: add invariant that Run Policy batch
  controls are visible but disabled until Batch Run UI is ready.
- `docs/architecture/frontend.md`: mention paused batch controls in
  `WorkflowSettingsDialog`.
- `docs/contracts/workflow-types.md`: keep batch fields in the contract and note
  that UI editing is paused.
- `README.md`: adjust smoke checklist language if it currently asks operators to
  configure batch defaults through Settings.

## Testing Plan

Add or update focused tests before implementation:

- `WorkflowSettingsDialog` renders the three batch controls disabled in Run
  Policy.
- Clicking disabled batch switches does not call `onSettingsChange`.
- Editing normal Run Policy fields still works.
- Help content states that batch controls are paused until Batch Run UI is ready.

Run focused checks:

- `npm test -- src/features/workflows/components/WorkflowSettingsDialog.test.tsx`
- `npm test -- src/features/workflows/lib/workflowSettings.test.ts`
- `npm test -- src/AppCss.test.ts` if any layout/CSS changes are made.
- `npx tsc --noEmit`

## Future Reopen Criteria

Re-enable or relocate these controls only after Batch Run has a clear user-facing
flow, such as:

- A graph workspace `Run Batch` action.
- Row input via JSON/CSV/manual table.
- Clear row-to-variable mapping.
- Per-row result status and evidence links.
- A product decision on whether concurrency remains fixed at `1` or gains safe
  browser/session isolation.

At that point, the likely better UI is a dedicated `Batch` section or Batch Run
dialog, not general Run Policy.
