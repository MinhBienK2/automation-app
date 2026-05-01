# Graph Editor Link UX Design

## Status

Approved for specification on 2026-05-01.

This document designs a focused UX and validation refinement for the existing React Flow workflow graph editor. It does not replace the graph model, persistence layer, or compiler. It tightens the editing experience around selected nodes, selected links, `New node` drafts, and clear link direction.

## Problem

The graph editor currently makes it too easy for users to lose context:

- Selecting a link can leave node detail visible, so the inspector mixes two concepts.
- Node and link actions are spread across the canvas, inspector, and a full edge summary list.
- Edges are technically directed, but arrow and selected-edge styling are not visually strong enough.
- The node context menu exposes redundant actions such as edit and rename.
- Action type selection in the inspector uses a native select that is hard to search and does not match the rest of the graph palette UX.
- New workflows start with a Start-only draft graph, so users still need to know which button creates the first real step.
- The compiler only follows one target per source port, but the editor can make parallel links look possible unless the UI and validation make the rule explicit.

## Goals

- Keep `Start` as the single visible workflow entrypoint.
- Create new workflows with a ready draft path: `Start -> New node`.
- Let `New node` act as an unconfigured action step that can be connected while drafting.
- Make the inspector show exactly one selected concept: node detail, link detail, or graph summary.
- Remove the all-links list from the bottom of the inspector.
- Make node-to-node direction obvious through arrowheads, semantic edge labels, and selected-edge styling.
- Add a right-click link actions popup with delete support.
- Reduce the node right-click popup to `Duplicate`, `Help`, and `Delete`.
- Add an inspector `?` help button for the selected node.
- Replace action type native select with a searchable dropdown that follows the app design system.
- Add link rules that match compiler behavior and prevent misleading graph shapes.

## Non-Goals

- No graph-native execution engine rewrite.
- No replacement for React Flow.
- No auto-layout engine.
- No new persistence table or graph version change unless implementation reveals a compatibility blocker.
- No migration of existing saved graphs.
- No change to workflow run state shape.
- No broad redesign of all graph node semantics beyond the link rules listed here.

## Approved Decisions

- Keep `Start` node. `Start` remains the only entrypoint and cannot be deleted.
- Allow `New node` to be connected before an action type is chosen.
- Saving a graph with `New node` is allowed as a draft.
- Validate and Run must block unconfigured `New node` and show a node-level error.
- Node actions popup opens on right-click, not left-click.
- The all-links list at the bottom of the inspector is removed.
- New workflows should default to `Start -> New node`.

## Graph Model

`Start` remains a graph node with only an `out` output port. It defines the execution entrypoint and keeps the current compile model understandable.

`New node` is an action node in an unconfigured state:

- `node_type`: `action`
- `label`: `New node`
- `ports`: action ports, input `in` and output `out`
- `config`: `null`

`GraphNode.config` is already an unknown JSON payload in TypeScript and a `serde_json::Value` in Rust, so `null` is the least disruptive draft marker. A draft action node can be persisted and edited, but it cannot compile into an executable step until the user chooses an action type.

When the user chooses an action type:

- The node config becomes the default `ActionConfig` for that type.
- The label changes to the action label, such as `Open New Tab`, unless the user has already manually edited the label.
- The node remains selected so the user can continue editing fields.

Existing saved graphs are loaded as-is. The new `Start -> New node` default applies to newly created workflows and to explicit frontend fallback paths where an empty workflow needs a draft graph.

## Inspector Behavior

The inspector has three mutually exclusive modes.

```text
Selected link -> Link detail only
Selected node -> Node detail only
Nothing selected -> Graph summary or selection hint
```

Selecting a node clears selected edge state. Selecting an edge clears selected node state. This prevents mixed detail panels.

### Node Detail

Node detail should include:

- Editable node label in the inspector.
- Node type subtitle, such as `Action node` or `If node`.
- A `?` help button that opens existing node help content for the selected node.
- A connection view for incoming and outgoing links.
- Node-specific validation issues.
- Node config fields.
- `Focus` and `Delete` actions where applicable.

Rename is handled only by editing the node label in the inspector. The node context menu does not offer rename.

### Connection View

The connection view replaces the raw link list and raw port ids with readable route cards:

- Incoming: source node label, source port label, and current node input port label.
- Outgoing: current node source port label and target node label.
- Empty states: `No incoming link` and `No outgoing link`.
- Port labels use semantic text such as `Next`, `True`, `False`, `Loop`, `Done`, `Success`, `Failed`, `Error`, and `Finally`.

This view is local to the selected node. It does not list every graph link.

### Link Detail

Link detail should include:

- Header: `Link`.
- Route summary: source node and port to target node and port.
- Link issue block when validation returns edge-level issues.
- Actions: `Delete link`; optionally `Focus source` and `Focus target` if implementation can keep this small.

The inspector must not render selected node config while a link is selected.

## Canvas Interactions

### Edges

Edges must be visually directed:

- Every edge shows a clear arrowhead at the target side.
- Edge labels use semantic port labels instead of raw ids when possible.
- Normal edges use the app's green accent at a readable contrast.
- Selected edges use a brighter/different stroke and a thicker line.
- Selected edge arrowhead and label styling match the selected stroke.
- Issue edges use warning/error styling and still have a distinct selected state.

Click behavior:

- Left-click edge selects only that edge and opens link detail.
- Right-click edge opens a `Link actions` menu at the pointer location.
- The link menu includes `Delete`; it may include `Focus source` and `Focus target`.

### Nodes

Click behavior:

- Left-click node selects only that node and opens node detail.
- Right-click node opens a `Node actions` menu.

The node context menu contains only:

- `Duplicate`
- `Help`
- `Delete`

`Delete` is disabled or hidden for `Start`. `Edit`, `Rename`, and `Focus` are removed from the node context menu because edit/rename belong in the inspector and focus is available there.

Deleting a node removes connected edges, matching current behavior.

## Toolbar

Add `New node` near `Add Action`.

- `New node` creates an unconfigured action node with label `New node`.
- `Add Action` keeps its current meaning: open the action palette and create a configured action node from the chosen action type.
- Existing grouped node buttons for logic, variable, output, end, and fit remain.

New workflow graph creation should produce:

```text
Start -> New node
```

The new node should be selected by default when the workflow opens if practical. If selection is not easy at repository creation time, the editor may select the first non-start node on load.

## Action Type Dropdown

The action type field in node detail should become a searchable dropdown, not a native select.

Required behavior:

- Shows placeholder `Choose action type` for unconfigured action nodes.
- Provides search across action label and short description.
- Preserves action groups and common action discoverability from the existing action palette.
- Excludes graph-control action configs represented by graph nodes: `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, and `stop_workflow`.
- Uses existing design-system surfaces, borders, radius, dark theme, and green accent states.
- Supports keyboard and accessible selection semantics.

Choosing an action type resets action config to that type's default. This is intentionally destructive for the action config because changing executable type changes required fields.

## Link Rules

The editor and backend validation should agree on these rules:

- Connections are only valid from output port to input port.
- Self-links are not allowed.
- Each input port allows at most one incoming edge.
- Each output port allows at most one outgoing edge.
- Multiple branch paths remain supported through multiple named output ports, not through multiple edges from the same port.
- Connecting to an already-used input or from an already-used output should replace the previous edge for that port instead of creating a parallel edge.
- Duplicate edges between the same source port and target port are invalid.
- Nodes unreachable from `Start` remain validation errors.

The one-edge-per-output-port rule matches current compiler behavior, where `next_target` chooses only one edge for a source port. Without this rule, the canvas can imply parallel execution that the backend does not perform.

## Validation And Run Behavior

Saving is draft-friendly:

- Save persists unconfigured `New node` drafts.
- Save persists disconnected drafts if the backend currently allows them.

Validate and Run are stricter:

- Unconfigured action node: blocking error on that node.
- More than one edge from the same output port: blocking error.
- More than one edge into the same input port: blocking error.
- Self-link: blocking error.
- Duplicate edge: blocking error.
- Missing `Start`: blocking error, preserved for compatibility.
- Multiple `Start` nodes: blocking error, preserved for compatibility.
- Unreachable non-start node: blocking error, preserved.

Run continues to save the visible graph first. If graph validation or compilation rejects the graph, the runner does not start and the UI shows a readable command error plus node/edge issue state when available.

## Compatibility

Existing saved graphs should remain loadable. If an existing graph has multiple edges from one port, validation should explain the issue instead of silently choosing one path. The compiler may keep its deterministic fallback behavior internally, but Run must reject invalid ambiguous graphs before execution.

Legacy step fallback graph generation can keep producing `Start -> step(s) -> End Success` for workflows that still have ordered step rows. Empty new workflows should use `Start -> New node`; existing Start-only graphs are still valid drafts but not runnable.

## Testing

Frontend tests should cover:

- New workflow/default empty graph renders `Start -> New node`.
- `New node` can be selected, renamed in inspector, connected, saved, and blocked by validation/run until action type is selected.
- `New node` changes label and default config after choosing an action type.
- Inspector renders node detail only when a node is selected.
- Inspector renders link detail only when a link is selected.
- Bottom all-links summary is absent.
- Node help `?` opens help for the selected node.
- Node context menu contains only `Duplicate`, `Help`, and `Delete`.
- Edge context menu contains `Delete`.
- Selected edge styling and marker state are represented in React Flow edge props/classes.
- Action type dropdown search filters by label and description.
- Existing Add Action palette still creates configured action nodes.

Rust/domain tests should cover:

- Default graph helper for empty workflow creation when implemented server-side.
- Draft action node validation returns a clear blocking issue.
- Duplicate/self/parallel edge rules return edge-level issues.
- Compile/run rejects ambiguous graph edges before runner start.
- Existing Start-only and legacy linear graph compatibility remains intact.

CSS/design tests should cover:

- Graph edge selected class/style has distinct color and width.
- Searchable dropdown and connection cards follow existing dark design tokens.
- No raw all-link list remains in the inspector.

## Documentation Updates

Implementation should update current source-of-truth docs when code changes land:

- `docs/domain/product-model.md`: new workflow default graph changes from Start-only to `Start -> New node`.
- `docs/domain/user-visible-invariants.md`: default graph, link rules, and draft-run behavior.
- `docs/domain/workflow-lifecycle.md`: create/open/edit graph behavior.
- `docs/architecture/frontend.md`: inspector modes, searchable action type dropdown, and context menu ownership.
- `docs/contracts/workflow-types.md`: draft action node representation and link validation rules.

`DESIGN.md` must be consulted before implementation because this changes user-facing layout/styling.

## Implementation Boundaries

Keep implementation focused:

- Prefer small extracted components for node detail, link detail, connection cards, link menu, and searchable action type dropdown.
- Do not merge this with unrelated runner, autosave, or settings work.
- Do not change action taxonomy beyond reusing existing action labels/groups/descriptions.
- Keep backend validation authoritative; frontend should prevent obvious invalid links but cannot be the only guard.
