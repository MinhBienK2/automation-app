# Graph Autosave, Settings, And Refactor Design

Date: 2026-05-01

## Summary

This design cleans up the workflow graph authoring flow in one product-first pass. It adds app-level graph autosave with a Settings page, changes new workflows to start with only a Start node, keeps graph JSON as the workflow source of truth, prevents runs from using stale saved graphs, and refactors the largest related production modules after behavior is covered by tests.

## Current Findings

- Workflow graph data is stored in SQLite in `workflow_graphs.graph_json`, keyed by workflow id.
- Action nodes are persisted as graph nodes with `node_type = "action"`.
- The concrete browser action type is not a separate DB column; it is stored inside the node config JSON as `config.type`, for example `{ "type": "click", "config": { ... } }`.
- Graph edits currently live in React state until the user clicks Save or Run.
- Running from the detail page already attempts to save the visible graph before calling `run_workflow`, but there is no continuous autosave state, no setting, and no visible save status.
- New workflows currently create a default `Start -> End Success` graph.
- The workflow detail UI has duplicated Validate, Run, and Save actions in both the page header and graph editor toolbar.
- Several production files related to graph editing and command/domain logic are larger than 600 lines and should be split after tests cover the behavior change.

## Goals

- Make graph persistence match user expectations: graph changes autosave by default.
- Add an app-level Settings page reachable from the sidebar.
- Let users turn graph autosave on or off globally.
- Start new workflows with only a Start node.
- Keep the visible draft graph safe when autosave fails.
- Prevent Run from executing an older saved graph.
- Remove confusing duplicate graph actions from the detail UI.
- Refactor large related production modules without changing behavior outside this scope.
- Keep current docs synchronized with the new behavior.

## Non-Goals

- Do not split graph nodes, action configs, or action types into separate database tables.
- Do not add per-workflow autosave settings.
- Do not remove legacy `workflow_steps` compatibility paths in this pass.
- Do not refactor every large production file in the repository.
- Do not refactor large test suites unless required to support the behavior changes.
- Do not implement cloud sync, collaboration, or native settings-file storage.

## Behavior And Data Model

`workflow_graphs.graph_json` remains the graph authoring source of truth. It stores graph nodes, edges, viewport, labels, node types, ports, and node config. Action type persistence remains inside action node config JSON. This avoids schema churn and preserves the current graph workspace contract.

New workflows create a graph with exactly one node:

```text
Start
```

The Start node is an undeletable anchor. The initial graph may be saved and reopened as a draft. It should not be treated as a runnable workflow. Attempting to run a graph with no executable nodes must fail before the runner starts with a readable validation error:

```text
Add at least one executable node before running.
```

Legacy compatibility conversion can still represent existing ordered step rows as a linear graph. When there are legacy steps, that generated compatibility graph may include `Start -> actions -> End Success` so old data remains understandable.

Autosave is an app-level local preference:

- Default: enabled.
- Scope: all workflows in the app.
- Storage: local browser storage in the first pass.
- Setting name: graph autosave.

When autosave is enabled, graph changes are debounced and persisted through `save_workflow_graph`. Autosaved changes include:

- node creation and deletion
- node label changes
- action type and action config changes
- structured graph node config changes
- node position changes
- edge creation and deletion
- viewport pan and zoom changes

Viewport changes can use a longer debounce or save on move end to avoid excessive writes.

When autosave is disabled, graph edits remain as local draft state until the user clicks Save or Run. Save remains available in both modes as a manual retry and explicit persistence action.

When autosave fails:

- Keep the draft graph on screen.
- Show a visible save status or error.
- Let the user continue editing.
- Retry on later changes when autosave is enabled.
- Let the user click Save to retry immediately.
- Do not discard or reload over the draft automatically.

Run always attempts to save the visible graph first. If that save fails, Run must not call `run_workflow`. This prevents the backend from executing an older saved graph.

## UI And UX

The sidebar gains a second navigation item:

- Workflows
- Settings

The active item follows the current screen. The collapsed sidebar preserves accessible labels and icons. Use `lucide-react` icons where possible to match the existing UI dependency set.

The app gains a `settings` screen. The Settings page contains a focused Workflow Editing section with a single app-level control:

- Autosave graph changes

The setting text should be short and operational. It should explain that autosave stores graph edits after changes, and turning it off requires using Save manually.

Workflow detail shows graph save state near the primary page actions or graph status area. Supported states:

- Saved
- Unsaved changes
- Saving...
- Autosave failed
- Autosave off

The page header owns the primary workflow actions:

- Validate
- Run
- Save
- Stop while running

The graph toolbar focuses on canvas actions:

- Add Action
- Add Logic
- Add Variable
- Add Output
- Add End
- Fit
- Delete or duplicate selected items when available

The duplicated Validate, Run, and Save controls should be removed from the graph editor toolbar to reduce ambiguity.

For a new Start-only workflow, the canvas selects Start by default. The inspector or empty state should guide the user to add an Action or Logic node next. The app must not auto-add End Success.

Workflow list UI should avoid presenting the legacy `step_count` as the main product signal because graph-only workflows no longer use list step authoring. The backend summary contract can keep `step_count` until a separate contract rename is approved.

Business and safety copy must continue to frame manual approval, challenge detection, and similar nodes as safe human-in-the-loop controls for authorized automation. The UI must not imply CAPTCHA bypass, anti-bot evasion, spam automation, or third-party account-control bypass.

## Refactor Scope

Refactor production code larger than 600 lines when it is directly related to the graph autosave/settings/default graph work.

### In Scope

`src/features/workflows/components/WorkflowGraphEditor.tsx`

Split into focused components and helper files:

- `WorkflowGraphCanvas.tsx`: React Flow canvas, selection, node and edge events.
- `WorkflowGraphToolbar.tsx`: add node/action, fit, and selected canvas actions.
- `WorkflowGraphInspector.tsx`: selected node and edge editing.
- `WorkflowGraphNode.tsx`: node rendering and port handles.
- `WorkflowGraphPalettes.tsx`: action, logic, variable, output, and end pickers.
- `workflowGraphEditorTypes.ts`: shared editor types if needed.

The parent editor should retain orchestration state and handlers, not all rendering details.

`src/features/workflows/components/StepForm.tsx`

Extract reusable action config editing so the graph inspector does not depend on the legacy step form component:

- `ActionConfigEditor.tsx`

Only split additional field helpers when needed to keep the extracted component maintainable.

`src-tauri/src/commands.rs`

Move graph command and graph run expansion logic into a focused Rust module or service. The command boundary should stay thin, and graph run behavior should be easier to test.

`src-tauri/src/domain/workflow_graph.rs`

Split graph domain types, validation, and compilation helpers if needed while changing Start-only defaults and no-executable-node run validation. Keep serde-compatible shapes unchanged.

`src/styles/workflows.css`

Move graph-specific styles into a dedicated stylesheet such as `src/styles/workflow-graph.css`, then import it through the existing style entry path.

### Out Of Scope For This Pass

The following production files are large and should be tracked as follow-up refactor candidates, but they are not the main path for this change:

- `src-tauri/src/runner/actions/mod.rs`
- `src-tauri/src/domain/action_config.rs`
- `src/features/workflows/lib/stepHelpContent.ts`
- `src/features/workflows/lib/workflowStepForm.ts`
- `src/types/workflow.ts`

Large test files are not part of the refactor scope unless a focused split is needed for the new tests.

## Implementation Order

1. Use `.agents/skills/test-driven-development` before implementation code.
2. Add or update tests for Settings navigation, autosave setting persistence, autosave behavior, autosave failure behavior, Start-only default graph, and Start-only run rejection.
3. Add the Settings screen and app-level autosave preference.
4. Implement autosave state, debounce, save status, manual retry, and run-before-save protection.
5. Change new workflow default graph to Start-only and update frontend fallback/default helpers.
6. Update graph validation or run compile behavior so Start-only graphs can be saved but cannot be run.
7. Remove duplicate Validate, Run, and Save actions from the graph editor toolbar.
8. Refactor the in-scope production files while preserving tested behavior.
9. Update current docs and README smoke checklist.
10. Run focused checks first, then broader checks for the touched areas.

## Testing Strategy

Frontend focused tests should cover:

- Sidebar navigation opens Settings.
- Settings toggles graph autosave and persists the app-level preference.
- Autosave is enabled by default.
- Editing graph nodes, edges, config, positions, and viewport schedules a graph save when autosave is enabled.
- Editing graph state does not autosave when autosave is disabled.
- Autosave failure leaves the draft graph visible and shows an error.
- Save retries after autosave failure.
- Run attempts to save the visible graph first.
- Run does not call the run command if the save fails.
- Workflow detail no longer renders duplicate primary graph actions.

Rust focused tests should cover:

- Creating a workflow creates a Start-only default graph.
- Loading the default graph round-trips from persistence.
- Deleting a workflow cascades graph deletion.
- Start-only graph validation allows draft save but run rejects it with a clear command-facing error.
- Graphs with executable action paths still compile and run through the existing runner path.

Expected checks:

- `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx`
- `npm test -- src/layouts/AppShell.test.tsx`
- focused Settings/App tests added by the implementation
- `npx tsc --noEmit`
- `cd src-tauri && cargo test --test persistence`
- `cd src-tauri && cargo test --test command_api`
- `cd src-tauri && cargo test --test domain_validation`
- `cd src-tauri && cargo fmt --check`
- `cd src-tauri && cargo clippy --all-targets --all-features`

The exact frontend focused test file names may change during implementation if components are split.

## Docs To Update During Implementation

Update current source-of-truth docs when implementation changes behavior:

- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/architecture/frontend.md`
- `docs/architecture/persistence.md`
- `docs/contracts/workflow-types.md`
- `README.md`

Update `docs/task-routes.md` if Settings ownership or new verification paths need to be discoverable for future agents.

Historical specs under `docs/superpowers/` are context only and should not be treated as current truth.

## Acceptance Criteria

- A newly created workflow opens with a graph containing only Start.
- Start is selected by default and cannot be deleted.
- Users can add nodes and build the graph without an auto-created End Success node.
- Autosave is enabled by default.
- Settings page can disable and re-enable autosave globally.
- Graph edits autosave when autosave is enabled.
- Graph edits do not autosave when autosave is disabled.
- Autosave failure preserves the visible draft and shows a readable status or error.
- Save manually persists the draft and clears save error state when successful.
- Run saves the visible graph first and does not run if save fails.
- Start-only graph can be saved but cannot start a runner execution.
- Header and graph toolbar no longer duplicate primary Validate, Run, and Save actions.
- Related production files over 600 lines are split according to the approved scope where they are touched.
- Current docs and README reflect graph-only, autosave, Settings, and Start-only default behavior.
