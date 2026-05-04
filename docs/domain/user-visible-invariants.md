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
- The main graph toolbar exposes New node, Add Action, Add Logic, Add Variable, and Add End. It does not expose Add Output or a duplicate Fit button.
- Add Logic stays beginner-focused: Branching, Loops, and Recovery/Retry are visible; advanced or policy-like logic nodes remain compatible for saved graphs but hidden from the main palette.
- Add Action uses semantic groups and user-intent labels. User-facing labels may differ from serialized action types, for example Fill Field still saves as `input_text`.
- Selecting a graph link clears node selection and shows link-scoped actions. Selecting a node clears link selection and shows node-scoped inspector content.
- Multi-selecting graph nodes or links shows a selection summary with bulk duplicate, copy, and delete actions. Bulk edits never delete, copy, paste, or duplicate the `start` node. Duplicate and paste create fresh ids and only preserve internal links inside the selected/copied fragment.
- Graph undo/redo applies to graph edit snapshots only. Run state, validation results, save status, settings, and workflow metadata are not part of graph undo history.
- Graph editor keyboard shortcuts do not fire while focus is inside inputs, textareas, contenteditable elements, action/node palettes, help dialogs, or dropdown popovers.
- Selected graph nodes expose detailed help from the inspector. Configured action nodes reuse decision-guide action help content; graph-native nodes explain purpose, minimum setup, ports and flow, workflow examples, and common mistakes in the same popup format.
- `break_loop` and `continue_loop` are only valid when reachable through a loop body branch.
- Manual approval and rate-limit graph nodes are safe control points; the app must not present them as CAPTCHA, anti-bot, spam, or account-creation bypass tools.

## UI Behavior

- Workflow list and detail remain separate screens.
- Settings is a separate app screen reachable from the sidebar.
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
- Browser sessions remain open after success, failure, and stop.
- Failures identify the failed step when possible.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include the legacy `step_count` field until the summary contract is renamed.
- Saved workflow graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
