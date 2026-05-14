# Workflow List Run Button Design

## Status

Approved for spec-only documentation on 2026-05-14.

## Problem

The workflow list currently exposes row actions for viewing details, editing
settings, duplicating, exporting, and deleting a workflow. It does not expose a
direct Run action.

This forces operators to open the workflow detail page before starting a saved
workflow, even when they only want to rerun an already configured workflow.

## Goal

Add a `Run` button to each workflow row in the workflow list.

The button should run the saved workflow graph with saved Workflow Settings,
without opening the workflow detail page first.

## Non-Goals

- Do not add inline graph editing to the list.
- Do not add batch run from the list.
- Do not add per-run overrides.
- Do not add a new backend command.
- Do not change `run_workflow` semantics.
- Do not auto-save unsaved detail-page drafts from the list. A list run uses the
  saved graph/settings already persisted for that workflow.

## Current Behavior

Workflow list row actions:

- `View Details`
- `Edit <workflow name>`
- `Duplicate <workflow name>`
- `Export <workflow name>`
- `Delete <workflow name>`

Workflow detail has the primary graph run action. Detail run saves the visible
graph and dirty settings before invoking `run_workflow`.

The list page does not own the visible graph draft, so it cannot safely save an
unsaved detail-page graph before running. It should therefore run the persisted
workflow state only.

## Proposed Behavior

Each workflow card gets an icon-only `Run <workflow name>` button.

Placement:

- Put `Run` after `View Details` and before `Edit`.
- Keep existing icon-only row action style and tooltip behavior.
- Use a play/run icon from the existing icon library.

Action behavior:

- Clicking `Run <workflow name>` calls the existing `runWorkflow(workflow.id)`
  app flow.
- The app remains on the workflow list.
- The run uses the saved graph and saved Workflow Settings.
- If the backend rejects validation/compile/run start, show the existing readable
  app error surface.
- If another workflow run is active, keep using the existing active-run rejection
  behavior from the command layer.

Status behavior:

- The list should not navigate to detail just to show progress.
- If current app status already has a shared header/status surface, reuse it.
- If the list has no visible run status today, add a small list-level status area
  that shows running/success/failed/stopped and the workflow name if available.
- Do not add graph node progress to the list; graph progress remains a detail
  workspace feature.

Disabled/loading behavior:

- Disable all row Run buttons while a workflow run is active.
- Optionally show the clicked row as running if the app stores the launched
  workflow id.
- Keep View/Edit/Duplicate/Export/Delete behavior unchanged unless existing
  active-run policy already blocks them elsewhere.

## Error Handling

List Run should surface the same categories of errors as detail Run:

- Graph validation errors.
- Settings validation errors.
- Active-run conflict.
- Backend startup/runtime failure after the run starts.

If `runWorkflow` returns immediately with `running`, the list should show the run
state as started and rely on existing polling/state refresh logic if available.
If the current app only polls from detail, implementation must extend polling so
list-started runs still reach terminal status.

## Data Flow

Frontend:

1. User clicks `Run <workflow name>` on a workflow card.
2. `WorkflowListPage` calls a new prop such as `onRunWorkflow(workflow)`.
3. `App.tsx` calls the existing `runWorkflowCommand(workflow.id)`.
4. App stores run status/error using the same run-state path as detail runs.
5. App polls `get_run_state` while status is `running`, regardless of whether
   the detail page is open.

Backend:

- No new command.
- Existing `run_workflow` loads saved graph and saved settings.
- Existing validation, compilation, runner, browser retention, evidence, and
  active-run lifecycle remain authoritative.

## UX Rationale

The list is an operational surface. A direct Run button makes sense for workflows
that are already configured and do not need graph inspection before every run.

Keeping it icon-only preserves the current dense row action style. Placing it
next to View Details makes the choice clear:

- View Details: inspect/edit the graph.
- Run: execute the saved workflow as-is.

## Documentation Updates

When implemented, update current docs:

- `docs/domain/workflow-lifecycle.md`: workflow list row actions include Run and
  list Run uses saved graph/settings.
- `docs/domain/user-visible-invariants.md`: add accessible `Run <workflow name>`
  row action and list-run behavior.
- `docs/architecture/frontend.md`: `WorkflowListPage` owns the list Run action
  trigger while `App.tsx` owns run orchestration.
- `docs/contracts/run-state.md`: note that runs can be started from list or
  detail and polling must work without detail being open.
- `README.md`: add list Run to smoke checklist.

## Testing Plan

Follow TDD for implementation.

Frontend tests:

- `WorkflowListPage` renders icon-only `Run <workflow name>` for each workflow.
- Clicking list Run calls `run_workflow` with that workflow id.
- Clicking list Run does not call `get_workflow` or navigate to detail.
- List Run surfaces command errors readably.
- Run buttons are disabled while run state is `running`.
- App polls run state for a list-started run until terminal status.

Suggested focused checks:

- `npm test -- src/features/workflows/pages/WorkflowListPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrapper behavior changes.
- `npx tsc --noEmit`

## Open Implementation Notes

- Use a stable accessible label: `Run <workflow name>`.
- Use the existing tooltip-backed `IconButton`.
- Avoid adding a text button to row actions unless the row layout is redesigned.
- Ensure mobile row action wrapping still fits after adding one more icon.
- If row action density becomes too high, move lower-frequency actions such as
  Export/Delete behind a later overflow menu in a separate design.
