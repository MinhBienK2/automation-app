# Frontend Architecture

## Purpose

The frontend renders workflow management UI, owns interaction state, and calls typed Tauri command wrappers.

## Key Files

- `src/App.tsx`: top-level state orchestration.
- `src/features/settings/pages/SettingsPage.tsx`: app-level settings, including graph autosave.
- `src/features/workflows/pages/WorkflowListPage.tsx`: workflow list screen.
- `src/features/workflows/pages/WorkflowDetailPage.tsx`: graph-only workflow workspace.
- `src/features/workflows/components/WorkflowGraphEditor.tsx`: React Flow visual graph workspace and graph orchestration state; canvas parts, toolbar, palettes, and inspector panels are split into sibling `WorkflowGraph*` component modules.
- `src/features/workflows/components/ActionConfigEditor.tsx`: reusable action config editor dispatcher used by graph action nodes and the legacy step form container; concrete fields are split into grouped `ActionConfig*Fields.tsx` modules.
- `src/features/workflows/components/WorkflowGraphInspectorFields.tsx`: structured graph node config fields used by the graph inspector.
- `src/features/workflows/lib/workflowActionDefaults.ts`: frontend default action config catalog used by graph node creation and re-exported through `workflowGraph.ts`.
- `src/features/workflows/components/StepForm.tsx`: legacy step form container; list-step UI is no longer rendered.
- `src/features/workflows/components/RunStatusBar.tsx`: run status and errors.
- `src/lib/workflowApi.ts`: Tauri invoke wrappers.
- `src/lib/workflowUi.ts`: pure UI helpers, labels, summaries, run-state normalization.
- `src/types/workflow.ts`: DTO and action config types.

## Belongs Here

- User interaction state.
- Form rendering and local validation display.
- Visual graph editing state before persistence.
- App-level graph autosave preference and graph save status presentation.
- Graph validation/run controls and presentation of validation issues for the selected node or selected link.
- Selected-node port guidance for required body ports, optional no-op branches, implicit successful continuation endings, and recovery branches that preserve failure behavior when missing.
- DTO-to-React-Flow and React-Flow-to-DTO adapter state, while keeping persisted `WorkflowGraph` as source of truth.
- Action node creation from the action palette, unconfigured `New node` draft creation from the toolbar, graph-control node creation from grouped node pickers, plus searchable type selection and config editing through the reusable action config editor.
- Command invocation through `workflowApi.ts`.
- UI-only labels, summaries, grouping, and failure suggestions.
- Settings navigation state in the app shell/sidebar.

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
