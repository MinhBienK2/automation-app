# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Opening a workflow shows the visual graph builder as the only workflow authoring surface.
- New workflows have a `Start -> New node` draft graph.
- Workflow list `Edit` opens Workflow Settings at General.
- Workflow list row actions are icon-only controls with accessible labels for View Details, Run `<workflow name>`, Edit, Duplicate, Export, and Delete. Duplicate creates a separate copy named `Copy of <name>`, preserves the saved graph and non-storage copied settings without package-export sanitization, creates a fresh browser identity/profile/fingerprint, and disables Run from selected for the copy.
- Workflow deletion uses an in-app confirmation dialog that asks whether to keep or delete the workflow's private browser profile data. Keeping profile data is the default. Deleting profile data removes only unshared inactive profile directories.
- Workflow list Run executes the saved graph and saved Workflow Settings without opening the detail page or saving detail-page drafts. List Run buttons are disabled while any workflow run is active, and list-started runs keep polling run state until terminal status.
- Workflow list exposes Import Workflow. Import rejects workflow package files larger than 5 MB before reading JSON, shows a preview, and always creates a new workflow on success; it never overwrites an existing workflow or leaves a partial workflow after failed validation.
- Schedules is a separate sidebar page for creating and auditing workflow schedules across workflows. A workflow can have multiple schedules.
- Scheduled runs use the latest saved workflow graph and saved Workflow Settings at fire time; unsaved workflow detail drafts are not run.
- Schedules run only while the Electron app process is active. Missed occurrences are skipped and recorded; the scheduler does not run catch-up backlogs.
- If a schedule fires while a normal workflow run or batch run is active, that occurrence is skipped with reason `active_run`; one-time schedules are disabled after the skipped opportunity.
- Enabled schedules must have valid schedule config and a currently runnable saved workflow. Disabled draft schedules can point at workflows that are still being authored.
- Schedule event history records started, skipped, missed, failed-to-start, and disabled decisions independently from run evidence rows.
- Workflow package export can include Flow and selected Workflow Settings sections. Export opens the native system Save dialog so users can choose the folder and file name. Export sanitizes machine-local or sensitive settings fields by default, including proxy passwords, credentials embedded in proxy URLs, and secret search/hash portions of fingerprint preflight probe URLs.
- Workflow detail exposes a compact header command bar. Settings, Validate, and Save are accessible icon controls with tooltips; Settings opens Workflow Settings at Browser Launch. Run is the primary text action, Stop appears only while running, and Run from selected appears only when its workflow setting makes it relevant.
- Workflow Settings contains General, Run Policy, Browser Launch, Graph, and Environment sections. It is per-workflow and distinct from the app-level Settings screen. Settings are saved through a single dialog-level Save Settings action rather than separate section save buttons.
- Workflow Settings Run Policy exposes maximum workflow duration and browser retention as editable fields. Batch concurrency, batch headless, and stop-on-first-failed-row values remain visible but disabled with a pause note until Batch Run UI is ready.
- Workflow Settings Graph exposes the new link wait default for newly created graph links in one grouped control. It supports no default wait, fixed duration milliseconds, or random min/max milliseconds, and changing it must not rewrite existing links.
- Workflow Settings Environment exposes initial variable values as typed rows for graph template/runtime context.
- Workflow Settings Browser Launch exposes browser identity controls. Each workflow has a stable read-only `identity_id`, editable display name, and fixed CloakBrowser fingerprint seed. `profile_dir` remains internal storage metadata and is not shown as a separate Browser Launch field. The seed is hidden by default but can be revealed or copied by the operator. Renaming the display name does not change profile storage or the fingerprint seed.
- Workflow Settings Browser Launch exposes Reset identity and Duplicate identity controls. Reset asks for confirmation, creates a new identity id/profile directory/fingerprint seed, preserves non-storage preferences such as proxy and locale, and disables Run from selected until a fresh retained session exists. Duplicate creates a new identity id/profile directory/fingerprint seed with a copied display name and copied non-storage preferences; it does not copy browser storage.
- Workflow Settings Browser Launch exposes a Reuse login session checkbox. Turning it on uses the identity's stable persistent browser profile; turning it off clears `profile_name` so the run uses temporary browser storage while keeping the same identity seed.
- Workflow Settings Browser Launch exposes an Enable Run from selected checkbox. It can only be enabled when Reuse login session is on and browser retention is `retain`; turning Reuse login session off also disables Run from selected.
- Workflow Settings Browser Launch exposes proxy URL/credentials/bypass and non-secret proxy metadata, timezone, locale, GeoIP, viewport/device, allowlisted advanced fingerprint overrides, a Humanize browser input toggle, a Humanize preset select with `default` and `careful`, optional owned fingerprint preflight, and headless launch controls. Fingerprint preflight requires an allowlisted probe origin and headed mode.
- Set Viewport is an in-run viewport-size action. Active authoring exposes width and height only; device scale factor, mobile viewport, and touch input are configured in Workflow Settings Browser Launch before Chromium starts.
- Workflow Settings saves and workflow deletion must reject browser identity profile reset/delete while a retained browser session is still active for that workflow/profile.
- Workflow Settings section help exposes a compact English/Vietnamese language toggle and explains each section field in enough detail for an operator to decide what the field controls and when to use it.
- Closing Workflow Settings with unsaved edits asks whether to save and close, discard changes, or keep editing.
- Graph autosave is an app-level setting. It is enabled by default and can be changed from Settings.
- When graph autosave is enabled, graph edits save after changes. When disabled, users save graph edits manually.
- Running from the graph workspace saves the visible graph before execution.
- Running from the graph workspace saves dirty Workflow Settings sections before execution.
- Run from selected is a workflow-detail action. It is hidden unless enabled in Workflow Settings, runs from exactly one selected main-path node to the end using the retained browser session, saves visible graph/settings first, and is disabled unless Reuse login session is enabled, browser retention is `retain`, and the retained session matches the workflow/profile directory.
- If the retained browser was closed manually, Run from selected remains unavailable or fails with a readable stale-session message; it must not silently launch a new browser from the selected node.
- If saving the visible graph fails before a run, the run does not start.
- If saving dirty Workflow Settings fails before a run, the run does not start.
- Graph edges are connected through explicit ports so branch intent is visible.
- New graph edges copy the saved Graph link wait at creation time. Edge waits are duration-only transition delays and compile before the target node; explicit Wait and Random Wait nodes remain the user-visible choice for page-state waits and named workflow pauses.
- Every graph canvas port exposes one custom hover tooltip after a 1 second hover delay. The tooltip names the port, explains its role, tells the user whether to connect into it from a previous output or drag from it to the next input, and must render above neighboring graph nodes.
- Each graph output port can have at most one outgoing edge, and each graph input port can have at most one incoming edge except the explicit Merge `in` port, which accepts multiple branch inputs. Reconnecting a non-Merge input should replace the previous link in the editor; backend validation rejects ambiguous saved graphs.
- Graph control blocks keep branch work separate from continuation work. `If`, `Switch`, and `Try/Catch` continue after branch work through a `done` port.
- Merge is a graph-native fan-in point, not a synchronization join. The path that reaches Merge continues through `out`; if `out` is unconnected, that path ends successfully.
- Router is a graph-native decision table. It evaluates stable-id cases from top to bottom, runs the first matching case branch or default branch, then continues through `done` when connected.
- Missing optional graph branches are no-ops. Missing continuation ports end that path successfully. Missing recovery branches on retry, try/catch, and fallback preserve failure behavior where specified by the graph semantics.
- Graph validation issues are shown before graph execution. Unsupported graph semantics must be reported clearly.
- A Start-only graph can be saved as a draft but cannot start a runner execution.
- Unconfigured action graph nodes can be saved as drafts but block validation/compile/run until an action type is selected.
- The main graph toolbar exposes icon controls for undo, redo, select mode, pan mode, fit view, auto arrange, and shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End. Toolbar-created nodes appear near the center of the currently visible canvas view instead of a fixed graph origin. Auto arrange repositions nodes into deterministic left-to-right execution columns and is part of graph undo history. It does not expose Add Output.
- The graph toolbar exposes a Shortcuts action that opens graph mouse and keyboard guidance without leaving the workspace.
- Add Logic stays beginner-focused: Branching, Loops, and Recovery/Retry are visible. Branching includes If, Switch, Router, and Merge.
- Add Action uses semantic groups and user-intent labels. User-facing labels may differ from serialized action types, for example Fill Field still saves as `input_text`.
- Targetable action editors default Target locator type to XPath, while still allowing Test ID, Role, Label, Placeholder, Text, CSS, and Attribute locators.
- Scroll authoring exposes Page, Into View, and Until Visible modes. Page mode shows Direction and Pixels; element-targeted modes show Target locator, optional Iframe XPath, and Timeout ms.
- Browser identity belongs in Workflow Settings Browser Launch. Launch-time identity settings are not represented as in-run action nodes in the current workflow contract.
- The Wait action group includes fixed Wait and Random Wait actions. Random Wait requires minimum and maximum milliseconds, with maximum greater than or equal to minimum. Link waits use the same duration constraints but stay scoped to the edge transition.
- Selecting a graph link clears node selection and shows link-scoped actions, including none/fixed/random link wait editing. Selecting a node clears link selection and shows node-scoped inspector content.
- Multi-selecting graph nodes or links shows a selection summary with bulk duplicate, copy, and delete actions. Bulk edits never delete, copy, paste, or duplicate the `start` node. Duplicate and paste create fresh ids and only preserve internal links inside the selected/copied fragment.
- Graph undo/redo applies to graph edit snapshots only. Run state, validation results, save status, settings, and workflow metadata are not part of graph undo history.
- Graph editor keyboard shortcuts only fire after the graph workspace is active through pointer or focus interaction, and they do not fire while focus is inside inputs, textareas, contenteditable elements, action/node palettes, help dialogs, or dropdown popovers.
- Dragging empty graph canvas creates a selection box by default. Holding Space temporarily switches the canvas to pan mode, and the toolbar pan hand can keep pan mode active until select mode is chosen again.
- Selected graph nodes expose detailed schema-backed help from the inspector. Configured action nodes show an action guide popup with a compact header language toggle, minimum setup, detailed field and option explanations grouped by required, optional, and advanced, output guidance, workflow examples, and safety notes when relevant. Graph-native nodes explain purpose, ports and flow before minimum setup, grouped field and option explanations, and workflow examples in the same popup format. Common mistake guidance appears inside relevant field or option details, not as a separate top-level section.
- `break_loop` and `continue_loop` are only valid when reachable through a loop body branch.
- Set Variables can write multiple typed values in one node. Duplicate paths are allowed and later rows/nodes overwrite earlier values at the same path.
- Set Variables remains a tabular row editor; narrow inspectors must contain it without crushing fields.
- Set JSON Variables requires an object root, flattens nested object fields into dot-path variables, and preserves arrays as arrays at their key.
- Template tokens such as `{{user.name}}` remain manually editable, can be inserted through a variable picker in supported template fields, and are visually highlighted without changing the stored text. The picker should expose known variables from variable nodes and output-producing actions where the graph already defines them.
- Repeat For Each manual list mode keeps literal item order. Variable-array mode loops over the current array variable in index order and fails clearly when the variable is missing or not an array.

## UI Behavior

- Workflow list and detail remain separate screens.
- Workflow list does not expose raw `updated_at` values; graph editing state belongs in the detail screen.
- Workflow deletion uses an in-app confirmation dialog, not the browser-native confirm prompt.
- Icon-only workflow and graph controls keep accessible labels and expose visible tooltip text on hover/focus through the shared icon button primitive.
- Settings is a separate app screen reachable from the sidebar.
- Schedules is a separate app screen reachable from the sidebar.
- Settings includes graph shortcut guidance for navigation, selection, editing, run, and save controls.
- On/off settings use the shared switch treatment. Compact exclusive choices such as Help language and Variables Rows/JSON use the shared segmented-control treatment with a clear active state.
- User-facing layout and styling changes follow `DESIGN.md`.
- Command errors are shown as readable messages.
- Workflow detail shows graph save state such as saved, unsaved changes, saving, autosave failed, or autosave off without raw workflow `updated_at` metadata in the detail controls row.
- Running a graph shows status in the page header and reflects graph progress through canvas node state.
- Run issues distinguish blocking graph validation issues, runtime failures, and system/startup errors. Issues with graph context can select the affected node or link.
- Runtime and system run issues keep the long raw error collapsed behind Details, expose Copy details, and show only a short contained summary by default. The graph inspector mirrors the selected node's last run error with the same collapsed-details behavior so long Playwright/CloakBrowser messages do not overflow the workspace.
- Run issues remain visible while users interact with or edit the graph. When an edit may have made the issue results stale, the issue panel must say the issues need recheck instead of disappearing silently.
- Graph run colors are semantic: green is reserved for completed/successful paths, cyan/blue indicate selection or active execution, amber indicates validation issues, and red indicates failure.
- Selecting a graph node or link must not replace amber validation or red failure color with cyan selection color. Selection can add a secondary ring or emphasis while preserving the issue/failure color.

## Command Boundary

- Electron IPC command errors serialize as `{ message, field? }`.
- Renderer code calls the typed `window.workflowApi` bridge through `src/lib/workflowApi.ts`.
- The renderer must not import Node, Electron, filesystem, SQLite, Playwright, or CloakBrowser APIs directly.

## Runner Behavior

- Full runs execute the compiled saved graph.
- Full runs launch through CloakBrowser/Playwright in the Electron backend, with humanized interaction enabled by default.
- Full runs use persisted Workflow Settings as the run baseline. Browser Launch identity settings, including profile directory, fingerprint seed, proxy, timezone, locale, viewport/device flags, supported WebRTC IP policy values, advanced fingerprint overrides, humanize toggle/preset, preflight, and headless mode, are resolved before browser launch. Environment initial variables are applied before the first graph step; saved edge waits compile into synthetic wait steps before target nodes; Run Policy max duration cancels and fails overlong runs with a timeout reason.
- Set Viewport updates runtime viewport width and height only.
- Headed CloakBrowser runs on Linux fail with a clear display prerequisite message when no `DISPLAY` or `WAYLAND_DISPLAY` is configured.
- Domain allowlist graph nodes become a run-scope navigation policy. Disallowed Navigate/Open New Tab URLs fail after template rendering and before browser navigation.
- Browser identity profile directories persist Chromium user data under the user's app data directory so login/session state can survive app and OS temp cleanup. Runs without persistent session reuse use temporary browser storage but still keep the configured identity seed unless the operator explicitly resets or duplicates the identity.
- Missing Workflow Settings rows return lazy v2 defaults.
- Stop returns a stopped state immediately; active-run ownership clears after the runner finishes cancellation.
- Batch runs share active-run ownership with normal runs, can be stopped through Stop, and expose progress/summary in run outputs.
- Browser sessions remain open after success, failure, and stop by default. Workflow Settings Run Policy browser retention can close the browser by default, and terminal End Success, End Failure, or Stop Workflow nodes can explicitly request closure.
- Failures identify the failed step when possible.
- Screenshots, downloads, and failure screenshots are written under run-scoped evidence directories and surfaced through structured `__evidence` metadata.
- `browser_identity` output evidence includes a fingerprint seed hash, non-secret network metadata, timezone/locale source, supported WebRTC policy, active advanced overrides, configured humanization status and preset, and CloakBrowser wrapper/binary version evidence.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include list metadata only; saved graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
- Saved Workflow Settings are keyed by workflow id and touch the parent workflow `updated_at`. Saving General also updates the workflow summary name.
