# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed Tauri command wrappers.

## Key Files

- `src/App.tsx`: top-level state orchestration.
- `src/features/workflows/pages/WorkflowListPage.tsx`: workflow list screen.
- `src/features/workflows/pages/WorkflowDetailPage.tsx`: graph-only workflow workspace.
- `src/features/workflows/components/WorkflowGraphEditor.tsx`: React Flow visual graph workspace, action palette for new action nodes, action/logic inspector with action-type selection, explicit port connections, edge deletion, validation panel, run timeline, and captured output context.
- `src/features/workflows/components/StepForm.tsx`: legacy container for the reusable `ActionConfigEditor`; list-step UI is no longer rendered.
- `src/features/workflows/components/RunStatusBar.tsx`: run status and errors.
- `src/lib/workflowApi.ts`: Tauri invoke wrappers.
- `src/lib/workflowUi.ts`: pure UI helpers, labels, summaries, run-state normalization.
- `src/types/workflow.ts`: DTO and action config types.

## Belongs Here

- User interaction state.
- Form rendering and local validation display.
- Visual graph editing state before persistence.
- Graph validation/run controls and presentation of validation issues, timeline status, and output context.
- DTO-to-React-Flow and React-Flow-to-DTO adapter state, while keeping persisted `WorkflowGraph` as source of truth.
- Action node creation from the action palette, plus type selection and config editing through the reusable action config editor.
- Command invocation through `workflowApi.ts`.
- UI-only labels, summaries, grouping, and failure suggestions.

## Does Not Belong Here

- SQL behavior.
- Runner/browser implementation.
- Backend validation as the only source of truth.
- Ad hoc string manipulation of persisted config JSON.
- List-step authoring UI.

## Change Checklist

- Keep props and DTO shapes aligned with `src/types/workflow.ts`.
- Update focused component/page tests.
- Read `DESIGN.md` before layout or styling changes.
- Keep command names centralized in `workflowApi.ts`.
