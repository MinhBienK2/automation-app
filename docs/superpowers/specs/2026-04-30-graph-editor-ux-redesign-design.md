# Graph Editor UX Redesign

## Context

The workflow detail screen already uses React Flow as the only workflow authoring surface, but the current UI still exposes implementation details and crowds the graph workspace with a long node palette. Users should be able to build and understand workflows directly on the canvas.

## Goals

- Let the workflow detail screen use the full content width to the right of the sidebar.
- Replace the long graph node palette with compact canvas toolbar groups.
- Keep browser actions and graph logic separate so users do not see duplicate ways to create branches, loops, retries, or stops.
- Make graph direction and execution order visible through edge arrows, labels, and order markers.
- Support direct canvas actions through a node context menu.
- Keep the inspector focused on configuration and readable connection summaries, not layout controls or raw port ids.

## Non-Goals

- No auto-layout engine in this pass.
- No drag-from-edge-to-create-node flow in this pass.
- No persistence or Rust graph contract changes.
- No runner behavior changes.

## Design

The workflow detail page should expand to the full available width beside the sidebar. The graph editor owns the dense workspace layout, while the list screen can keep its narrower reading width.

The graph editor toolbar should provide grouped creation controls:

- Add Action opens the existing action picker.
- Add Logic opens a new picker with search and categories for branching, loops, recovery, flow control, and safety nodes.
- Add Variable, Add Output, and Add End create or open focused graph-node groups for supporting workflow state and terminal nodes.

The action picker should hide graph-control actions such as `if_condition`, `repeat_times`, `repeat_for_each`, `retry_block`, and `stop_workflow`. These remain represented as graph nodes.

Logic nodes should expose clear port labels on the canvas:

- If: True and False paths.
- Switch: case paths and Default.
- Loops: Loop and Done.
- Retry and recovery nodes: Try, Success, Failed, Error, or Finally as applicable.
- Terminal nodes: no outgoing path.

Edges should show direction using arrowheads, keep the semantic port label visible, and show an order marker when the graph can be walked from Start. This makes a linear workflow readable while preserving branch labels.

Right-clicking a node should open a canvas context menu with Edit, Rename, Duplicate, Focus, Help, and Delete. Start cannot be deleted. Help should be available as a lightweight modal or inline explanation surface for the selected node type.

The inspector should remove Move Left and Move Right because users can drag nodes on the canvas. It should also hide raw values like `input: in` and `output: out`. A Connections section should summarize incoming and outgoing links in user-facing language.

## Testing

Add focused UI tests that first fail against the current implementation:

- Workflow detail uses a full-width screen class.
- Graph palette exposes grouped toolbar controls instead of the long list of Add buttons.
- Logic picker opens with search and categories.
- Action picker omits graph-control logic actions.
- Inspector hides raw port ids and move buttons while showing connection summaries.
- Right-clicking a node opens the context menu.
- Edges render arrow/order/label affordances through accessible labels or testable DOM.

## Documentation

Update the frontend architecture and workflow lifecycle docs if the implementation changes the current authoring behavior description. The source-of-truth graph DTOs and Rust contracts should remain unchanged.
