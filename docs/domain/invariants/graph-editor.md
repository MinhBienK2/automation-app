# Graph Editor Invariants

Preserve these unless the task explicitly changes them.

## Graph Structure

- Graph edges connect through explicit ports so branch intent is visible.
- Each output port has at most one outgoing edge; each input port has at most one incoming edge except Merge `in` (multiple inputs).
- Reconnecting a non-Merge input replaces the previous link; backend validation rejects ambiguous graphs.
- Control blocks (`If`, `Switch`, `Try/Catch`) continue after branch work through a `done` port.
- Merge is fan-in, not synchronization. Path reaching Merge continues through `out`; unconnected `out` ends successfully.
- Router evaluates stable-id cases top-to-bottom, runs first matching or default branch, continues through `done`.
- Missing optional branches are no-ops. Missing continuation ports end that path successfully.
- `break_loop` and `continue_loop` are valid only inside a loop body branch.
- A Start-only graph can be saved but cannot run.
- Unconfigured action nodes can be saved but block validation/compile/run.

## Canvas Nodes

- Nodes show saved label as primary text, action/kind as secondary, category badge top-right.
- Action, logic, subflow nodes use distinct restrained accent colors; running uses cyan.
- Nodes expand vertically when ports are many so handles do not overlap.
- Auto arrange and loaded graphs must leave clearance for port-aware heights.
- Auto arrange wraps long main paths into left-to-right rows, preserves same-column ordered-port order, keeps continuation chains in their branch lane.
- Multi-output blocks keep separate control-flow lanes.

## Canvas Interaction

- Dragging empty canvas creates a selection box; Space enables pan mode; toolbar can keep pan mode active.
- Dragging a node starts from the body; ports are link-creation targets only.
- Selecting a link clears node selection; selecting a node clears link selection.
- Graph inspector opens as right-side drawer on selection; closing clears selection.
- Detail opens with no selection so canvas uses full width.
- Graph shortcuts fire only after workspace is active; suppressed inside inputs, textareas, palettes, help dialogs, popovers.
- Undo/redo applies to graph edit snapshots only — not run state, validation, save, settings.
- Graph run colors: green = completed, cyan = active/selection, amber = validation, red = failure.
- Selection must not replace amber/red with cyan; add secondary emphasis while preserving issue color.
- Link visual kinds (main, branch, continuation, loop, recovery) adjust stroke; semantic states take priority.

## Toolbar

- Controls: undo, redo, select mode, pan mode, fit view, auto arrange, shortcuts, New node, Add Action, Add Subflow, Add Logic, Add Variable, Add End.
- Toolbar-created nodes appear near visible canvas center.
- Auto arrange is part of undo history.
- Merge `in` multi-link ordering must not override source node ordered output ports.
- Shortcuts action opens keyboard/mouse guidance.
- Add Subflow visible only for workflow graphs (hidden for subflow graphs).
- Add Logic: Branching (If, Switch, Router, Merge), Loops, Recovery/Retry.

## Edge Waits

- New edges copy the saved Graph link wait default at creation time.
- Edge waits are duration-only transition delays compiled before the target node.
- Explicit Wait/Random Wait nodes remain the user choice for page-state waits.
- Changing the default must not rewrite existing links.

## Node Inspector

- Non-start nodes expose a Node name field; renaming updates canvas, saved graph, compiled labels, traces.
- Action inspectors group related multi-field controls by purpose: targets, content, outputs, match values, artifacts, policy, guards, cases, terminal behavior.
- Single-field actions (Press Key, Hotkey, Set Clipboard) remain ungrouped.
- Target source: Use locator vs Use Find Element ref (ref hides locator fields).
- Help popup: language toggle, collapsible sections, ports/flow, setup, fields, outputs, examples, safety notes.
- Port hover tooltips explain role and connection direction after 1s delay.

## Multi-Selection

- Bulk actions: duplicate, copy, delete, and workflow-only Create subflow.
- Never duplicate/copy/paste/delete the `start` node.
- Duplicate/paste create fresh ids and only preserve internal links.
- Create subflow from selection: `Chỉ tạo` (keep graph) and `Tạo và thay thế` (replace with Call Subflow node if one entry, ≤1 external in/out, no split branching).

## Action Authoring

- Add Action uses semantic groups and user-intent labels (e.g., Fill Field → `input_text`).
- Default Target locator type: XPath; also allows Test ID, Role, Label, Placeholder, Text, CSS, Attribute.
- Drag and Drop: separate Drag source and Drop setup groups with distinct labels.
- Scroll: Page Scroll, Scroll To Element, Scroll Until Element Visible labels.
- Set Variables: tabular row editor, must fit narrow inspectors, duplicate paths allowed, later rows overwrite.
- Set JSON Variables: object root required, objects and arrays are preserved natively and resolved dynamically at runtime using deep path lookups.
- Template tokens `{{name}}` are manually editable, insertable via picker, visually highlighted.
- Repeat For Each: manual list keeps literal order; variable-array mode fails clearly when missing/non-array.
