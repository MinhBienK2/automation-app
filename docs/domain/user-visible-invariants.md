# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Opening a workflow shows the visual graph builder as the only workflow authoring surface.
- New workflows have a `Start -> New node` draft graph.
- Workflow list `Edit` opens Workflow Settings at General.
- Workflow list row actions are icon-only controls with accessible labels for View Details, Edit, Duplicate, Export, and Delete. Duplicate creates a separate copy named `Copy of <name>` and preserves the saved graph and full copied settings without package-export sanitization.
- Workflow list exposes Import Workflow. Import reads a workflow package, shows a preview, and always creates a new workflow; it never overwrites an existing workflow.
- Workflow package export can include Flow and selected Workflow Settings sections. Export opens the native system Save dialog so users can choose the folder and file name. Export sanitizes machine-local or sensitive settings fields by default, including proxy passwords, download directories, cookies, storage rows, and session restore refs.
- Workflow detail exposes a header Settings action that opens Workflow Settings at Browser.
- Workflow Settings contains General, Execution, Browser, Environment, Variables, Triggers, and Advanced sections. It is per-workflow and distinct from the app-level Settings screen. Settings are saved through a single dialog-level Save Settings action rather than separate section save buttons.
- Workflow Settings Variables only exposes initial variable values. It hides the legacy input schema and batch mapping fields from the UI, while preserving those persisted fields for compatibility.
- Variables can be edited as typed rows or as a JSON object. Switching modes keeps both views synchronized: nested JSON becomes dot-path rows, and dot-path rows become nested JSON.
- Workflow Settings Browser exposes a Reuse login session checkbox. Turning it on uses a named persistent browser profile and generates a stable profile name when the field is empty; turning it off clears `profile_name` so the run uses temporary browser state.
- Workflow Settings Browser exposes a Device profile selector for Default browser, Desktop Chrome, Android Chrome, iPhone Safari, and Custom user agent. Presets update user agent, viewport width/height, mobile, and touch settings together; raw user-agent editing is reserved for Custom.
- Workflow Settings Execution exposes wait-between-nodes controls. Users can enable a fixed wait or random wait range between graph nodes. Explicit Wait and Random Wait nodes override the global setting at their position.
- Workflow Settings Execution exposes interaction fidelity, DOM fallback, and timing profile controls. Existing workflows retain standard fidelity until changed.
- Workflow Settings Browser exposes fingerprint preflight controls for enablement, probe URL, identity profile, allowed origins, and proxy metadata. Enabling preflight requires an allowlisted HTTP(S) probe URL, an identity profile, and headed browser mode.
- Workflow Settings Triggers is a planned/compatibility section until a scheduler service exists. It must not present trigger modes or policies as active scheduling controls.
- Workflow Settings section help exposes a compact English/Vietnamese language toggle and explains each section field in enough detail for an operator to decide what the field controls, when to use it, and what overrides it. Browser help keeps persisted field keys such as `profile_name`, `proxy_server`, and `challenge_policy` visible even in Vietnamese.
- Closing Workflow Settings with unsaved edits asks whether to save and close, discard changes, or keep editing.
- Graph autosave is an app-level setting. It is enabled by default and can be changed from Settings.
- When graph autosave is enabled, graph edits save after changes. When disabled, users save graph edits manually.
- Running from the graph workspace saves the visible graph before execution.
- Running from the graph workspace saves dirty Workflow Settings sections before execution.
- If saving the visible graph fails before a run, the run does not start.
- If saving dirty Workflow Settings fails before a run, the run does not start.
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
- The Wait action group includes fixed Wait and Random Wait actions. Random Wait requires minimum and maximum milliseconds, with maximum greater than or equal to minimum.
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
- Workflow deletion uses an in-app confirmation dialog, not the browser-native confirm prompt.
- Icon-only workflow and graph controls keep accessible labels and expose visible tooltip text on hover/focus through the shared icon button primitive.
- Settings is a separate app screen reachable from the sidebar.
- Settings includes graph shortcut guidance for navigation, selection, editing, run, and save controls.
- On/off settings use the shared switch treatment. Compact exclusive choices such as Help language and Variables Rows/JSON use the shared segmented-control treatment with a clear active state.
- User-facing layout and styling changes follow `DESIGN.md`.
- Command errors are shown as readable messages.
- Workflow detail shows graph save state such as saved, unsaved changes, saving, autosave failed, or autosave off without raw workflow `updated_at` metadata in the detail controls row.
- Running a graph shows status in the page header and reflects graph progress through canvas node state.
- Run issues distinguish blocking graph validation issues, runtime failures, and system/startup errors. Issues with graph context can select the affected node or link.
- Run issues remain visible while users interact with or edit the graph. When an edit may have made the issue results stale, the issue panel must say the issues need recheck instead of disappearing silently.
- Graph run colors are semantic: green is reserved for completed/successful paths, cyan/blue indicate selection or active execution, amber indicates validation issues, and red indicates failure.
- Selecting a graph node or link must not replace amber validation or red failure color with cyan selection color. Selection can add a secondary ring or emphasis while preserving the issue/failure color.

## Command Boundary

- Tauri command errors serialize as `{ message, field }`.
- TypeScript invoke payload keys match Rust command parameters.
- TypeScript and Rust DTO shapes remain compatible.

## Runner Behavior

- Full runs execute the compiled saved graph.
- Full runs use persisted Workflow Settings as the run baseline. Browser settings, including headless mode, are resolved before browser launch; Environment defaults and Variables are applied before the first graph step; Execution default timeouts fill action timeout fields when unset; Execution max duration cancels and fails overlong runs with a timeout reason.
- Fingerprint preflight, when enabled, runs after browser/environment setup and before graph actions; a blocked or malformed verdict stops execution before user workflow actions.
- Execution wait-between-nodes settings are applied after graph compile and before runner start, excluding setup steps and explicit Wait/Random Wait override nodes.
- Named browser profiles persist Chromium user data under the user's app data directory so login/session state can survive app and OS temp cleanup. Runs without a named profile use temporary browser state.
- Missing Workflow Settings rows return lazy defaults. Legacy browser config commands map to `settings.browser`.
- Stop returns a stopped state immediately; active-run ownership clears after the runner finishes cancellation.
- Browser sessions remain open after success, failure, and stop by default. Workflow Settings Execution browser retention can close the browser by default, and terminal End Success, End Failure, or Stop Workflow nodes can explicitly request closure.
- Failures identify the failed step when possible.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include the legacy `step_count` field until the summary contract is renamed.
- Saved workflow graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
- Saved Workflow Settings are keyed by workflow id and touch the parent workflow `updated_at`. Saving General also updates the workflow summary name.
