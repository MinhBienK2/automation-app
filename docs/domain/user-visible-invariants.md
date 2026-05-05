# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Opening a workflow shows the visual graph builder as the only workflow authoring surface.
- New workflows have a `Start -> New node` draft graph.
- Graph autosave is an app-level setting. It is enabled by default and can be changed from Settings.
- When graph autosave is enabled, graph edits save after changes. When disabled, users save graph edits manually.
- Running from the graph workspace saves the visible graph before execution.
- If saving the visible graph fails before a run, the run does not start.
- Graph edges are connected through explicit ports so branch intent is visible.
- Each graph output port can have at most one outgoing edge, and each graph input port can have at most one incoming edge. Reconnecting a port should replace the previous link in the editor; backend validation rejects ambiguous saved graphs.
- Graph control blocks keep branch work separate from continuation work. `If`, `Switch`, and `Try/Catch` continue after branch work through a `done` port.
- Missing optional graph branches are no-ops. Missing continuation ports end that path successfully. Missing recovery branches on retry, try/catch, and fallback preserve failure behavior where specified by the graph semantics.
- Graph validation issues are shown before graph execution. Unsupported graph semantics must be reported clearly.
- A Start-only graph can be saved as a draft but cannot start a runner execution.
- Unconfigured action graph nodes can be saved as drafts but block validation/compile/run until an action type is selected.
- The main graph toolbar exposes icon controls for undo, redo, select mode, pan mode, fit view, and shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End. It does not expose Add Output.
- The graph toolbar exposes a Shortcuts action that opens graph mouse and keyboard guidance without leaving the workspace.
- Add Logic stays beginner-focused: Branching, Loops, and Recovery/Retry are visible; advanced or policy-like logic nodes remain compatible for saved graphs but hidden from the main palette.
- Add Action uses semantic groups and user-intent labels. User-facing labels may differ from serialized action types, for example Fill Field still saves as `input_text`.
- Selecting a graph link clears node selection and shows link-scoped actions. Selecting a node clears link selection and shows node-scoped inspector content.
- Multi-selecting graph nodes or links shows a selection summary with bulk duplicate, copy, and delete actions. Bulk edits never delete, copy, paste, or duplicate the `start` node. Duplicate and paste create fresh ids and only preserve internal links inside the selected/copied fragment.
- Graph undo/redo applies to graph edit snapshots only. Run state, validation results, save status, settings, and workflow metadata are not part of graph undo history.
- Graph editor keyboard shortcuts do not fire while focus is inside inputs, textareas, contenteditable elements, action/node palettes, help dialogs, or dropdown popovers.
- Dragging empty graph canvas creates a selection box by default. Holding Space temporarily switches the canvas to pan mode, and the toolbar pan hand can keep pan mode active until select mode is chosen again.
- Selected graph nodes expose detailed schema-backed help from the inspector. Configured action nodes show an action guide popup with a compact header language toggle, minimum setup, detailed field and option explanations grouped by required, optional, and advanced, output guidance, workflow examples, and safety notes when relevant. Graph-native nodes explain purpose, ports and flow before minimum setup, grouped field and option explanations, and workflow examples in the same popup format. Common mistake guidance appears inside relevant field or option details, not as a separate top-level section.
- `break_loop` and `continue_loop` are only valid when reachable through a loop body branch.
- Manual approval and rate-limit graph nodes are safe control points; the app must not present them as CAPTCHA, anti-bot, spam, or account-creation bypass tools.
- Set Variables can write multiple typed values in one node. Duplicate paths are allowed and later rows/nodes overwrite earlier values at the same path.
- Set Variables remains a tabular row editor; narrow inspectors must contain it without crushing fields.
- Set JSON Variables requires an object root, flattens nested object fields into dot-path variables, and preserves arrays as arrays at their key.
- Template tokens such as `{{user.name}}` remain manually editable, can be inserted through a variable picker in supported template fields, and are visually highlighted without changing the stored text. The picker should expose known variables from variable nodes and output-producing actions where the graph already defines them.
- Repeat For Each manual list mode keeps literal item order. Variable-array mode loops over the current array variable in index order and fails clearly when the variable is missing or not an array.

## UI Behavior

- Workflow list and detail remain separate screens.
- Workflow list does not expose legacy step counts or raw `updated_at` values; graph editing state belongs in the detail screen.
- Settings is a separate app screen reachable from the sidebar.
- Settings includes graph shortcut guidance for navigation, selection, editing, run, and save controls.
- User-facing layout and styling changes follow `DESIGN.md`.
- Command errors are shown as readable messages.
- Workflow detail shows graph save state such as saved, unsaved changes, saving, autosave failed, or autosave off.
- Running a graph shows status in the page header and reflects graph progress through canvas node state.

## Command Boundary

- Tauri command errors serialize as `{ message, field }`.
- TypeScript invoke payload keys match Rust command parameters.
- TypeScript and Rust DTO shapes remain compatible.

## Runner Behavior

- Full runs execute the compiled saved graph.
- Stop returns a stopped state immediately; active-run ownership clears after the runner finishes cancellation.
- Browser sessions remain open after success, failure, and stop unless the terminal End Success, End Failure, or Stop Workflow node has its close-browser option enabled.
- Failures identify the failed step when possible.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include the legacy `step_count` field until the summary contract is renamed.
- Saved workflow graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
