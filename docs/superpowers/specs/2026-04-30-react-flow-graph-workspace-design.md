# React Flow Graph Workspace Design

## Status

Approved for implementation on 2026-04-30.

This specification replaces the current hand-built graph canvas with a React Flow workspace and completes graph execution semantics across the frontend and Rust backend. It extends the existing graph-only workflow builder rather than replacing workflow persistence, Tauri commands, or action configuration contracts.

## Problem

Workflow detail currently exposes the visual graph as the only authoring surface, but the canvas is not usable as a real graph editor. Nodes are rendered as absolute-positioned buttons, edges are created through select fields, movement is limited to small button actions, and advanced graph nodes are only partly executable.

The target product behavior is stronger: users should be able to build, validate, save, run, and debug complex workflow graphs directly from detail view, including branches, loops, retry paths, fallback/error handling, manual checkpoints, rate limiting, and output-driven conditions.

## Goals

- Use `@xyflow/react` as the graph interaction layer for pan, zoom, drag, connect, handles, minimap, controls, background, and selection.
- Keep `WorkflowGraph` as the persisted source of truth.
- Add deterministic adapters between persisted graph DTOs and React Flow nodes/edges.
- Make the detail page a complete graph workspace with palette, canvas, inspector, toolbar, validation, timeline, and output context.
- Support executable graph semantics for action, branch, loop, retry, try/catch, fallback, manual approval, rate limit, success end, and failure end nodes.
- Preserve existing action config forms and backend action validation.
- Save the current graph before a run, then validate and execute the saved graph.
- Keep command-facing errors serializable through `CommandError`.
- Keep safety copy and behavior clear: manual checkpoints and challenge detection assist authorized human-in-the-loop automation; they do not bypass CAPTCHA, anti-bot systems, spam controls, or third-party account controls.

## Non-Goals

- Do not build CAPTCHA bypass, anti-bot evasion, spam automation, or stealth account automation.
- Do not replace SQLite graph persistence with a new storage system.
- Do not remove legacy workflow step compatibility paths unless a separate migration is approved.
- Do not introduce collaborative editing, cloud sync, or multi-user permissions.
- Do not make a separate implementation plan file for this request.

## Architecture

The graph workspace keeps the existing boundary:

```text
WorkflowDetailPage
  -> WorkflowGraphEditor
     -> React Flow canvas and UI state
     -> WorkflowGraph <-> React Flow adapters
     -> node/edge inspector
     -> validation/timeline/output panels
  -> workflowApi graph commands
  -> Tauri command boundary
  -> Rust graph validation and execution
  -> existing browser runner action executor
```

The persisted DTO remains:

```text
WorkflowGraph {
  version,
  nodes,
  edges,
  viewport
}
```

React Flow state is an implementation detail. Persisted graphs are converted into React Flow nodes and edges on load, then converted back to `WorkflowGraph` when saving, validating, or running.

## Frontend Workspace

The workflow detail screen contains three primary regions.

### Palette

The left palette lets users add nodes by click or drag:

- Action nodes grouped by the existing action taxonomy.
- Logic nodes: `if`, `switch`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`.
- Reliability nodes: `retry`, `try_catch`, `fallback`.
- Human/control nodes: `manual_approval`, `rate_limit`.
- Terminal nodes: `end_success`, `end_failure` when missing or when explicit failure branches are needed.

### Canvas

The center canvas uses React Flow for:

- Drag node.
- Pan and zoom.
- Fit view.
- Minimap.
- Controls.
- Grid background.
- Multi-select.
- Direct port/handle connection.
- Edge selection and deletion.
- Node deletion and duplication.
- Runtime and validation styling.

Node handles map to `GraphPort` ids. Edge handles map to `source_port` and `target_port`; no select-based connect form remains.

### Inspector

The right inspector edits the current selection:

- Node label.
- Action type and action config for action nodes.
- Conditions for branch and loop nodes.
- Switch cases and default behavior.
- Loop item/count/timeout settings.
- Retry attempts and delay.
- Try/catch/finally path behavior.
- Fallback behavior.
- Manual approval reason and timeout.
- Rate limit delay.
- Edge labels and edge conditions where supported.

When nothing is selected, the inspector shows graph summary, validation summary, and run summary.

## Toolbar Behavior

The workspace toolbar exposes:

- Save.
- Validate.
- Run.
- Stop while running.
- Fit view.
- Auto layout.
- Undo.
- Redo.
- Duplicate.
- Delete.

Run always saves the current graph first. Validation issues are clickable and select/focus the affected node or edge.

## Node Semantics

Graph execution uses explicit node semantics:

- `start`: exactly one graph entry point.
- `end_success`: completes the workflow successfully.
- `end_failure`: completes the workflow as a controlled failure with an optional reason.
- `action`: runs one existing `ActionConfig`.
- `if`: evaluates a condition and follows `true` or `false`.
- `switch`: evaluates an expression/output and follows the matching case or `default`.
- `repeat_times`: runs `loop` a fixed number of times, then `done`.
- `repeat_for_each`: binds each item to the configured item variable, runs `loop`, then `done`.
- `while`: evaluates before each iteration; `loop` while true, `done` when false.
- `repeat_until`: runs `loop` until the condition passes or timeout/max attempts triggers `timeout`.
- `retry`: runs `try`, retries failures up to `max_attempts`, then follows `success` or `failed`.
- `try_catch`: runs `try`; success follows `success`, failure follows `error`, and `finally` runs when connected.
- `fallback`: runs the primary branch and falls back when it fails, then follows `done`.
- `manual_approval`: pauses for explicit user approval, denial, or timeout.
- `rate_limit`: delays/paces execution before continuing.
- `break_loop`: exits the nearest loop context.
- `continue_loop`: starts the next iteration of the nearest loop context.

## Runtime Context

Graph execution owns a context containing:

- Captured outputs.
- Variables.
- Loop index and loop number.
- Current `repeat_for_each` item.
- Retry attempt.
- Node timeline events.
- Last error for catch/fallback paths.

Existing extract and variable actions update this context so later condition nodes can read their outputs.

## Validation

Backend validation is authoritative. The frontend may offer helpful display and disabled states, but it cannot be the only validation layer.

Validation covers:

- Exactly one `start`.
- Valid node ids, edge ids, and port ids.
- No dangling edges.
- Required input and output paths for executable nodes.
- Reachability from `start`.
- Reachability to terminal success/failure where appropriate.
- Cycles only when represented by supported loop/control semantics.
- Complete branch paths for `if`, `switch`, `retry`, `try_catch`, fallback, and loop nodes.
- Loop control nodes only inside loop context.
- Valid action configs through existing action validation.
- Valid manual approval and rate limit settings.
- Clear blocking errors before runner execution starts.

## Persistence And Contracts

- `workflow_graphs` remains the persisted graph store.
- Saving graph JSON does not rewrite legacy `workflow_steps`.
- `get_workflow_graph`, `save_workflow_graph`, `validate_workflow_graph`, `compile_workflow_graph`, and `run_workflow` remain the command surface.
- `WorkflowGraph.version` remains `1` unless a required DTO shape change is introduced.
- Optional config fields may be added in a backward-compatible way.
- TypeScript and Rust DTOs must remain serde-compatible.

## Run State And Timeline

Graph runs report progress by graph node id. The UI maps run state to:

- Current/running node.
- Completed nodes.
- Failed node.
- Timeline entries.
- Output context.
- Validation and command errors.

If existing `RunState` fields must remain for compatibility, graph-specific metadata is added without breaking old consumers.

## Testing

Frontend tests cover:

- DTO to React Flow adapter conversion.
- React Flow to DTO adapter conversion.
- Add node.
- Connect handles.
- Move node.
- Select node and edge.
- Delete node and edge.
- Edit action and logic config.
- Save graph.
- Validate graph and focus issue target.
- Run-state styling and timeline display.

Rust tests cover:

- Graph validation for each node semantic.
- Action config validation inside action nodes.
- Branch traversal.
- Loop traversal.
- Retry traversal.
- Try/catch/finally traversal.
- Fallback traversal.
- Manual approval and rate limit behavior.
- Command boundary serialization.
- Persistence roundtrip.

## Documentation Updates

Code changes update the source-of-truth docs that describe:

- Product model.
- Workflow lifecycle.
- Frontend architecture.
- Workflow type contracts.
- Run state contract.
- Execution semantics.
- Runner architecture if graph execution moves ownership.

## Rollout Discipline

Implementation is split into small phases. A phase is not considered done until its focused tests pass and docs for touched behavior remain accurate. Later phases may refine earlier code, but they should not leave a known-broken graph workspace.

The expected phase order is:

1. React Flow dependency, adapters, and editor replacement.
2. Advanced node config UI, validation focus, and editor polish.
3. Rust graph validation and execution semantics.
4. Graph run state, timeline, and output context.
5. Documentation sync and full verification.

## Self-Review

- Placeholder scan: no `TBD` or unfinished requirement remains.
- Consistency check: the spec keeps `WorkflowGraph` as source of truth while using React Flow only for UI interaction.
- Scope check: this is a broad full-stack feature, so the implementation is explicitly phased.
- Ambiguity check: advanced nodes are executable goals, not decorative editor-only nodes.
