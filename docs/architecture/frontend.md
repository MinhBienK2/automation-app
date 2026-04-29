# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed Tauri command wrappers.

## Key Files

- `src/App.tsx`: top-level state orchestration.
- `src/features/workflows/pages/WorkflowListPage.tsx`: workflow list screen.
- `src/features/workflows/pages/WorkflowDetailPage.tsx`: workflow workspace.
- `src/features/workflows/components/StepList.tsx`: ordered step list and Add Step palette.
- `src/features/workflows/components/StepForm.tsx`: selected step editing, save confirmation, and duplicate action.
- `src/features/workflows/components/TestStepMonitor.tsx`: test progress modal.
- `src/features/workflows/components/RunStatusBar.tsx`: run status and errors.
- `src/lib/workflowApi.ts`: Tauri invoke wrappers.
- `src/lib/workflowUi.ts`: pure UI helpers, labels, summaries, run-state normalization.
- `src/types/workflow.ts`: DTO and action config types.

## Belongs Here

- User interaction state.
- Form rendering and local validation display.
- UI-only action browsing for the Add Step palette.
- Command invocation through `workflowApi.ts`.
- UI-only labels, summaries, grouping, and failure suggestions.

## Does Not Belong Here

- SQL behavior.
- Runner/browser implementation.
- Backend validation as the only source of truth.
- Ad hoc string manipulation of persisted config JSON.

## Change Checklist

- Keep props and DTO shapes aligned with `src/types/workflow.ts`.
- Update focused component/page tests.
- Read `DESIGN.md` before layout or styling changes.
- Keep command names centralized in `workflowApi.ts`.
