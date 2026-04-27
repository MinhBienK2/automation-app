# Workflow UI Refactor Design

Date: 2026-04-27

## Context

The current frontend places workflow discovery, workflow detail editing, step creation, step editing, run controls, and the test-step monitor in one `App.tsx` surface. That makes the product harder to scan and makes the source harder to maintain. The app already has the right backend model and command surface, so this refactor must preserve core behavior while improving the frontend flow and component boundaries.

`DESIGN.md` is the source of truth for visual direction. The refactor must restore the dark Supabase-inspired theme across the whole app: near-black canvas, restrained borders, limited green accents, 8px-based spacing, no decorative gradients, and dense work-focused layouts.

## Chosen Approach

Use a two-screen application flow:

1. Workflow List screen
2. Workflow Detail screen

The list screen owns discovery and creation. The detail screen owns the selected workflow workspace: rename, run controls, ordered steps, add step, selected step config, drag reorder, test step, test all, stop, and the existing monitor popup.

Rejected alternatives:

- Keep the split sidebar/detail layout and only improve spacing. This would not solve the core UX issue.
- Add full routing with a router dependency. This is unnecessary for the Tauri MVP because the app has two screens and no URL-based navigation requirement.
- Move state management to an external store. The current state is local and command-driven; extracting components and command helpers is enough for this iteration.

## User Flow

### Workflow List

- User lands on a full-page workflow library.
- User can create a workflow by name.
- Each workflow appears as a compact row/card with name, step count, updated timestamp, and actions.
- `View Details` loads that workflow and switches to the detail screen.
- `Delete` keeps the existing confirmation behavior and refreshes the list.
- Creating a workflow opens the new workflow detail screen after creation.

### Workflow Detail

- Header shows a back action, workflow name field, save name, and run status.
- Back returns to the workflow list without deleting loaded state.
- The builder area is scoped only to the selected workflow.
- The step rail manages step order, selection, and add-step.
- The detail panel edits only the selected step.
- Run/test/stop behavior stays command-compatible with the current Tauri backend.
- Test Step Monitor behavior stays unchanged, only visually aligned with the design system.

## Code Organization

Create focused frontend modules:

- `src/types/workflow.ts`: shared TypeScript shapes matching Tauri command payloads.
- `src/lib/workflowApi.ts`: typed wrappers around `invoke` command names.
- `src/lib/workflowUi.ts`: pure UI helpers such as labels, summaries, run-state normalization, monitor status, and suggestions.
- `src/components/workflows/WorkflowListPage.tsx`: workflow list and creation screen.
- `src/components/workflows/WorkflowDetailPage.tsx`: selected workflow workspace and orchestration props.
- `src/components/workflows/StepList.tsx`: sortable step list and add-step form.
- `src/components/workflows/StepForm.tsx`: selected step form and action-specific fields.
- `src/components/workflows/RunStatusBar.tsx`: run status and command errors.
- `src/components/workflows/TestStepMonitor.tsx`: test-step monitor popup.
- `src/App.tsx`: top-level state, command orchestration, and screen switching only.

This keeps backend logic untouched and reduces the chance of breaking core run behavior.

## Data Flow

`App.tsx` remains the owner of loaded workflows, selected workflow detail, selected step id, run state, monitor state, form state for creation, and add-step action type. It calls typed API helpers, then passes state and callbacks down to pure components.

The backend command names and payload shapes remain unchanged:

- `list_workflows`
- `get_workflow`
- `create_workflow`
- `rename_workflow`
- `delete_workflow`
- `add_step`
- `update_step`
- `delete_step`
- `reorder_steps`
- `run_workflow`
- `test_step`
- `stop_run`
- `get_run_state`

## Error Handling

- Existing `CommandError.message` handling remains the user-facing error source.
- Command failures from create, rename, run, test, stop, and save step render in the nearest relevant status area.
- Delete confirmations remain browser confirmations for now.
- If loading a detail returns null, the app stays on the list screen and shows an error.

## Styling

- Replace the light theme with the existing dark design system.
- Use `#171717` and `#0f0f0f` for page and panels.
- Use `#2e2e2e`, `#363636`, and alpha green borders for depth.
- Use green only for active states, links, and primary action borders.
- Use 6px controls, 8px panels/cards, and pill primary buttons where appropriate.
- Keep text sizes work-focused; no oversized hero treatment.
- Use responsive single-column behavior below the existing mobile breakpoint range.

## Testing

Follow TDD for code changes.

Frontend tests must cover:

- Initial render shows the workflow list screen.
- Clicking `View Details` loads a workflow and hides the create/list surface.
- The detail screen has a `Back to Workflows` action that returns to the list.
- Existing create, add step, save step, test monitor, running disable, and delete confirmation behavior continues to pass.

Checks:

```text
npm test -- src/App.test.tsx
npx tsc --noEmit
npm run build
```

## DONE Criteria

- Workflow list and workflow detail are separate screens.
- No workflow list sidebar remains visible on the detail screen.
- Existing Tauri command payloads and behavior are preserved.
- `App.tsx` is reduced to orchestration instead of component implementation.
- Components, shared types, API helpers, and UI helpers are split into focused files.
- Styles follow `DESIGN.md` and no light-theme surface remains as the primary UI.
- Focused frontend tests pass.
- TypeScript check passes.
- Agent-facing technical documentation is created from the final code shape.
