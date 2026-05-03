# Power User Graph Editor Design

## Status

Approved by the user on 2026-05-03.

This spec documents the long-term "option 3" direction for the React Flow
workflow graph editor. Implementation should be phased. The first implementation
slice should deliver the core power-user editing foundation before adding
advanced navigation and layout tools.

## Problem

The visual graph editor already supports core authoring: adding nodes, choosing
action and graph-native node types, connecting explicit ports, replacing links
per port, selecting and deleting nodes or links, duplicating a single node,
opening context menus, editing through the inspector, fitting the viewport,
using the minimap, validating, saving, and showing run progress on canvas nodes.

That is enough for basic graph construction, but it is slow for users building
large or frequently edited workflows. Power users expect graph editors to support
keyboard-first editing, multi-selection, undo/redo, copy/paste, quick insertion,
search, issue navigation, bulk organization, and layout commands.

## Goals

- Make the graph editor efficient for power users without changing the persisted
  `WorkflowGraph` contract unless a later phase proves it necessary.
- Support multi-select, bulk duplicate, bulk delete, copy, paste, undo, redo, and
  keyboard shortcuts as the first implementation slice.
- Preserve graph semantics: explicit ports, one outgoing link per output port,
  one incoming link per input port, draft node saving, backend validation before
  run, and graph autosave behavior.
- Add quick graph construction tools in a second phase: quick add from a port and
  insert node on an existing edge.
- Add advanced navigation and organization in a third phase: command palette,
  node search, issue navigator, traversal selection, align/distribute, and
  auto-layout.
- Keep the existing Supabase-inspired dark visual system and React Flow canvas
  model.

## Non-Goals

- Do not add new graph node types in this design.
- Do not change Rust graph validation or compiler semantics for Phase 1.
- Do not persist editor-only state such as selection, history, clipboard, search
  query, command palette state, or issue navigator filters.
- Do not undo run state, validation results, save status, settings, or workflow
  metadata.
- Do not replace React Flow.

## Current Findings

Relevant current files:

- `src/features/workflows/components/WorkflowGraphEditor.tsx` owns the React Flow
  state bridge, selected single node, selected single edge, context menus,
  palette opening, node creation, link creation, deletion, and single-node
  duplication.
- `src/features/workflows/components/WorkflowGraphCanvasParts.tsx` renders graph
  nodes and explicit handles.
- `src/features/workflows/components/WorkflowGraphInspector.tsx` renders
  selected node and selected link inspector content.
- `src/features/workflows/components/WorkflowGraphToolbar.tsx` renders current
  add and fit controls.
- `src/features/workflows/lib/workflowGraph.ts` maps between persisted
  `WorkflowGraph` DTOs and React Flow nodes/edges.
- `docs/domain/user-visible-invariants.md`, `docs/domain/workflow-lifecycle.md`,
  and `docs/architecture/frontend.md` already describe current graph behavior
  and must be updated when implementation changes user-visible behavior.

Current gaps:

- Selection is modeled as one node id and one edge id. There is no app-level
  multi-selection model.
- Duplicate works only for a single node and does not duplicate internal links.
- There is no graph undo/redo stack.
- There is no graph copy/paste command.
- There are no graph editor keyboard shortcuts.
- There is no quick add from a port, quick insert on an edge, command palette,
  node search, issue navigator, traversal selection, align/distribute, or
  auto-layout.

## Approved Direction

The graph editor should become a speed-oriented editing surface similar in spirit
to an IDE for workflow graphs. The design is intentionally broader than the first
implementation slice, but implementation must stay phased so the editor remains
stable and testable.

Recommended delivery:

1. Phase 1: interaction foundation.
2. Phase 2: quick graph construction.
3. Phase 3: power navigation and organization.

## Phase 1: Interaction Foundation

Phase 1 is the first implementable slice.

Required behavior:

- Multi-select nodes and edges through React Flow selection box and modifier
  selection where React Flow supports it.
- App-level selection state tracks selected node ids and selected edge ids.
- Single-node and single-edge inspector behavior remains as it is today.
- When multiple nodes or edges are selected, the inspector shows a compact
  selection summary with bulk actions.
- Bulk delete removes selected non-start nodes, selected edges, and edges attached
  to deleted nodes.
- Bulk duplicate duplicates all selected non-start nodes.
- Bulk duplicate preserves node configs, labels, node types, ports, and group ids.
- Bulk duplicate preserves only internal edges whose source and target are both
  in the duplicated node set.
- Bulk duplicate never duplicates edges that connect to nodes outside the
  selection.
- The duplicated group is offset from the original group and becomes the active
  selection.
- Copy stores selected non-start nodes and internal selected edges in an
  editor-local clipboard.
- Paste creates new ids, preserves configs, preserves internal copied edges,
  offsets positions near the viewport center or current selection, and selects the
  pasted nodes.
- Undo restores the previous graph snapshot for graph edits.
- Redo reapplies an undone graph snapshot.
- History stores only graph snapshots and metadata, not run state or editor-only
  UI state.
- History stack should be bounded, with 50 snapshots as the default limit.

Keyboard shortcuts:

- `Delete` and `Backspace`: delete selection.
- `Ctrl/Cmd+Z`: undo.
- `Ctrl/Cmd+Shift+Z`: redo.
- `Ctrl/Cmd+Y`: redo.
- `Ctrl/Cmd+C`: copy selected non-start nodes.
- `Ctrl/Cmd+V`: paste.
- `Ctrl/Cmd+D`: duplicate selection.
- `Ctrl/Cmd+S`: save graph.
- `Ctrl/Cmd+Enter`: run graph when not running.
- `Ctrl/Cmd+Shift+Enter`: validate graph.
- `F` or `Ctrl/Cmd+0`: fit view.

Shortcut guardrails:

- Shortcuts must not trigger while focus is inside form controls, textareas,
  contenteditable elements, action/node palettes, help dialogs, command palette,
  or other modals.
- Editing shortcuts should be disabled while a graph run is active. Navigation
  shortcuts such as fit view may remain enabled.
- Browser defaults should only be prevented when the graph editor command is
  actually handled.

## Phase 2: Quick Graph Construction

Phase 2 builds on the Phase 1 command and selection model.

Required behavior:

- Output ports expose a quick-add affordance that opens a node/action picker near
  the port.
- Choosing a node from quick-add creates the node to the right of the source node
  and connects the source output port to the new node input port.
- Quick-add respects the existing link replacement rule: one link per output port
  and one link per input port.
- Selecting or context-clicking an edge exposes `Insert node here`.
- Inserting a node into an edge replaces `A -> B` with `A -> New -> B`.
- Insert preserves the original source node, source port, target node, and target
  port semantics.
- The new node is selected and shown in the inspector after quick-add or insert.
- If a chosen node has no input or no output port, insertion should either be
  disabled in the picker or fail with a readable UI message before changing the
  graph.

## Phase 3: Power Navigation And Organization

Phase 3 makes large graphs easier to operate.

Command palette:

- `Ctrl/Cmd+K` opens a command palette.
- Commands include add action, add graph node, validate, run, save, fit view,
  search node, focus selected, focus current running node, focus failed node,
  select upstream, select downstream, select disconnected nodes, align,
  distribute, and auto-layout.
- The command palette should reuse the visual treatment and search conventions of
  the existing action and node palettes.

Search and jump:

- Search by node label, node type, action type, validation issue message, and
  node id fallback.
- Selecting a search result focuses and selects the node or edge.
- Search should work without changing graph data.

Issue navigator:

- List all validation issues for the current graph.
- Clicking an issue focuses and selects the related node or edge.
- Graph-level issues remain visible even when no node or edge id is attached.

Traversal selection:

- Select downstream from selected node.
- Select upstream from selected node.
- Select branch from a selected output port when a port-specific action is
  available.
- Select disconnected nodes.
- Traversal commands should operate on the persisted graph topology, not on
  rendered canvas geometry.

Bulk organization:

- Align selected nodes left, right, top, bottom, horizontal center, or vertical
  center.
- Distribute selected nodes horizontally or vertically.
- Zoom to selection.
- Fit selected branch.
- Auto-layout the full graph or the selected branch.

Auto-layout:

- Prefer a proven layout engine if adding a dependency is acceptable during
  implementation.
- If dependency risk is too high, use a simple deterministic DAG layout starting
  from `start`.
- Auto-layout changes positions only. It must not change configs, ports, edges,
  labels, or validation semantics.
- Layout should keep branch nodes visually separated enough to reduce edge
  crossing, but it does not need to produce a perfect diagram in the first pass.

## Architecture

Keep `WorkflowGraph` as the source of truth. Add editor-only state and command
helpers around it.

Recommended modules:

- `useGraphHistory`: manages undo and redo stacks of `WorkflowGraph` snapshots.
- `useGraphSelection`: manages selected node ids and selected edge ids.
- `useGraphClipboard`: manages copied graph fragments in memory.
- `useGraphKeyboardShortcuts`: maps keyboard events to graph editor commands.
- `graphEditorCommands`: pure or mostly pure helpers for graph transformations.
- `GraphCommandPalette`: Phase 3 command palette UI.
- `GraphIssueNavigator`: Phase 3 issue list and focus UI.
- `GraphQuickAddMenu`: Phase 2 quick-add and edge insertion UI.

Command data flow:

1. React Flow event, toolbar action, context menu action, keyboard shortcut, or
   command palette item invokes an editor command.
2. The command receives the current `WorkflowGraph`, current selection, and
   command options.
3. The command returns `nextGraph` plus next selection where relevant.
4. The editor commits the graph through a single `commitGraphChange` path.
5. `commitGraphChange` pushes a history entry when appropriate and calls the
   existing `onChange(nextGraph)`.
6. Existing autosave behavior sees the graph edit normally.

History rules:

- Push one history entry per user-level action, not one per intermediate React
  Flow event.
- Dragging multiple nodes should commit as a single move action at the end of the
  drag when feasible.
- Run state updates must not push history.
- Validation issue changes must not push history.
- Undo and redo should clear transient context menus.

Selection rules:

- `start` may be selected but cannot be deleted, copied, pasted as a new node, or
  duplicated.
- Edge selection and node selection can both exist in multi-selection mode, but
  single-selection inspector behavior should remain clear.
- Selecting one node clears selected edges when it matches current behavior.
- Selecting one edge clears selected node detail when it matches current
  behavior.
- Multi-selection summary takes precedence when more than one selectable item is
  selected.

Id generation:

- New ids must be unique within the graph.
- Copy, paste, duplicate, quick-add, and insert commands should use a shared id
  helper rather than embedding `Date.now()` in multiple UI handlers.
- Edge ids should remain readable and deterministic enough for debugging, while
  still avoiding collisions.

## UI Design

Keep the current dark theme, compact panels, and React Flow canvas.

Toolbar additions:

- Add compact controls for undo, redo, command palette, search/issues, and layout
  when those phases are implemented.
- Keep add-node controls grouped and avoid turning the toolbar into explanatory
  documentation.

Inspector additions:

- Multi-selection summary:
  - number of selected nodes,
  - number of selected edges,
  - Duplicate,
  - Copy,
  - Delete,
  - later Align and Distribute actions.
- Selected edge actions:
  - Delete,
  - Insert node here in Phase 2.
- Single node inspector keeps existing config editing, connection summary,
  guidance, help, focus, and delete actions.

Context menu additions:

- Node context menu: Duplicate, Copy, Delete, Help.
- Multi-selection context menu: Duplicate selection, Copy selection, Delete
  selection.
- Edge context menu: Delete, Insert node here in Phase 2.

Accessibility:

- Bulk actions must be reachable by buttons, not keyboard shortcuts only.
- Search and command palettes should use dialog roles and labeled search inputs
  consistent with existing palettes.
- Shortcut behavior must not trap text editing.

## Error Handling

- Commands that cannot run should be disabled where possible.
- If a command is invoked through keyboard and cannot run, it should no-op unless
  the user needs feedback to understand data loss or invalid insertion.
- Copy with no copyable nodes should no-op.
- Paste with an empty clipboard should no-op.
- Delete selection should leave `start` intact.
- Duplicate selection should ignore `start` and duplicate the remaining selected
  nodes.
- Insert-on-edge should validate that the inserted node can connect from the old
  source to the old target before mutating the graph.
- Auto-layout failures should keep the original graph unchanged.

## Testing

Phase 1 tests:

- Unit tests for duplicate selection id mapping.
- Unit tests for copying and pasting selected nodes.
- Unit tests that only internal selected edges are copied.
- Unit tests that `start` is not deleted, copied, or duplicated.
- Unit tests for deleting selected nodes and attached edges.
- Unit tests for undo and redo stack behavior.
- Component tests for keyboard shortcuts.
- Component tests that shortcuts do not fire inside action config inputs,
  palettes, or dialogs.
- Component tests for the multi-selection inspector summary and bulk actions.

Phase 2 tests:

- Unit tests for quick-add graph transformation.
- Unit tests for insert-node-on-edge transformation.
- Component tests for edge context menu insertion.
- Component tests for port quick-add selection and auto-connect.

Phase 3 tests:

- Unit tests for search result ranking and issue matching.
- Unit tests for upstream, downstream, branch, and disconnected traversal.
- Unit tests for align and distribute position changes.
- Unit tests for auto-layout preserving graph configs and edges.
- Component tests for command palette execution and issue navigator focus.

Required checks during implementation:

- Run focused Vitest tests for edited graph helpers and components.
- Run `npx tsc --noEmit` when TypeScript types or props change.
- Run `npm test -- src/AppCss.test.ts` if CSS invariants change.

## Documentation Updates During Implementation

When implementation changes user-visible behavior, update:

- `docs/domain/workflow-lifecycle.md`
- `docs/domain/user-visible-invariants.md`
- `docs/architecture/frontend.md`
- `README.md` smoke checklist if run/save/validate workflow behavior changes

Phase 1 should update docs for graph shortcuts, multi-selection, bulk duplicate,
copy/paste, and undo/redo. Phase 2 should update docs for quick-add and edge
insertion. Phase 3 should update docs for command palette, search, issue
navigator, traversal selection, layout, and bulk organization.

## Acceptance Criteria

Phase 1 is complete when:

- Users can select multiple nodes and duplicate them as a connected group.
- Duplicating `A -> B -> C` creates `A Copy -> B Copy -> C Copy` when all three
  nodes are selected.
- Links from the duplicated group to unselected nodes are not copied.
- Users can copy and paste selected graph fragments.
- Users can undo and redo graph edits.
- Keyboard shortcuts cover delete, undo, redo, copy, paste, duplicate, save, run,
  validate, and fit view.
- Shortcuts do not interfere with typing into graph config fields or palette
  search fields.
- Existing graph save, autosave, validation, and run behavior still work.

Phase 2 is complete when:

- Users can create and connect a node directly from an output port.
- Users can insert a node into an existing edge without manually deleting and
  reconnecting the link.
- Port replacement rules and backend graph validation remain consistent.

Phase 3 is complete when:

- Users can execute graph commands from a command palette.
- Users can search and focus nodes or edges.
- Users can navigate validation issues from a graph-level list.
- Users can select upstream, downstream, branch, and disconnected graph sections.
- Users can align, distribute, and auto-layout nodes without changing graph
  semantics.

## Self-Review

- No placeholders remain.
- Phase boundaries are explicit.
- Phase 1 is small enough to become the next implementation plan.
- The design preserves current graph contracts and validation semantics.
- Editor-only state is kept out of persisted graph JSON.
