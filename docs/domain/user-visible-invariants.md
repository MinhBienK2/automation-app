# User-Visible Invariants

Preserve these unless the task explicitly changes them.

## Workflow Editing

- Blank workflow names are rejected.
- Opening a workflow shows the visual graph builder as the only workflow authoring surface.
- New workflows have a `Start -> New node` draft graph and are created with
  either the project saved session or a newly created private workflow session.
  The project saved session is the default create option.
- Workflow list cards show the selected session/environment name when one is
  available.
- Workflow list `Edit` opens Workflow Settings at General.
- Workflow list row actions are icon-only controls with accessible labels for View Details, Run `<workflow name>`, Edit, Duplicate, Export, and Delete. Duplicate creates a separate copy named `Copy of <name>`, preserves the saved graph and non-storage copied settings without package-export sanitization, creates a fresh browser identity/profile/fingerprint, and disables Run from selected for the copy.
- Workflow deletion uses an in-app confirmation dialog that asks whether to keep or delete the workflow's private browser profile data. Delete private browser profile data is checked by default, and keeping profile data requires unchecking it. Deleting profile data removes only unshared inactive profile directories. Backend deletion rejects while the workflow is actively running, while its persistent profile is used by an active run, or while a retained browser session still owns the workflow/profile.
- Workflow list Run executes the saved graph and saved Workflow Settings without opening the detail page or saving detail-page drafts. List Run is disabled only for a workflow that already has an active run, row status and Stop are scoped to that workflow's run id, and list-started runs keep polling run snapshots until terminal status. Duplicate, Export, and Delete are disabled for the active workflow row until that run reaches a terminal state.
- Workflow list exposes Import Workflow. Import rejects workflow package files larger than 5 MB before reading JSON, shows a preview, and always creates a new workflow on success; it never overwrites an existing workflow or leaves a partial workflow after failed validation.
- Browser recording never exposes captured password or secret-like text field values to the renderer. Top-level page navigations can become recorded `navigate` steps, but embedded frame navigations such as ad/user-sync iframes must not become workflow nodes. Text entry must preserve literal whitespace and clearing, contenteditable edits must capture visible editor text, and text-composition, edit-hotkey, deletion-key, or modifier-only keydown noise must not create workflow nodes or split one text entry into multiple Fill Field steps. Clipboard paste into non-sensitive targets records replayable Set Clipboard plus Paste steps and suppresses the duplicate input event caused by the paste; sensitive pasted values are redacted and excluded until reviewed. Generic clicks that only precede a checkbox/radio/select/upload control event must not create duplicate click nodes. A tab opened by a recorded click should replay as click plus tab switch; a tab created without a preceding click should replay as Open New Tab. Those generated input steps are excluded by default with a review warning until the operator supplies a safe literal or variable. Stopping a recorder drains buffered fallback events before review draft generation. Generated recording graphs preserve positive captured gaps between included steps as fixed edge delays and wrap long recordings into readable rows instead of one horizontal line. The workflow detail header does not expose Record Replacement. Saving a recording draft only honors reviewed labels, inclusion flags, supported captured value edits, and backend-held timing metadata against the backend-held draft steps; renderer-supplied action type, locator replacement, or timing replacement is ignored. Discarding a recording session and successfully saving a recording draft consume the backend in-memory recorder state instead of leaving reusable draft/session handles.
- Schedules is a separate sidebar page for creating and auditing workflow schedules across workflows. A workflow can have multiple schedules.
- Overview is the default Mission Control entry point. It shows backend-owned
  durable metrics, live operations, attention, activity, recent evidence
  metadata, and upcoming schedules for the operator's local day.
- Mission Control sidebar order is Overview, Projects, Evidence, Schedules,
  Identities, App Settings. Overview is the default first screen.
- Projects is the only sidebar entry for workflow authoring inventory. The
  selected project shows Workflows, Subflows, and Settings as a collection menu
  inside the project list sidebar. Workflows and subflows shown there are
  scoped to the selected project, and the project identity controls live in the
  selected project's Settings collection. The auto-created default project is
  named `Main`. Creating a project automatically creates a workflow named
  `Main` inside that project using its project saved session. Project Settings shows a `Project identity` heading, a
  `Project details` group with editable Project name, Save project name,
  Duplicate project, and Delete project, plus a `Browser fingerprint` group,
  editable Fingerprint seed, read-only Identity, Save fingerprint seed, and
  Regenerate identity without exposing a full Browser Launch editor. Duplicate
  project creates and selects an independent project copy with copied workflows
  and subflows, remapped Call Subflow references, and fresh browser
  identities/profiles. Delete project opens an in-app confirmation warning that
  workflows, subflows, and saved browser sessions inside the project will be
  deleted; Cancel keeps the project, and confirmation removes the selected
  project after backend active-run/retained-session guards pass. Regenerate
  identity opens an in-app confirmation warning that the current local project
  browser profile will be deleted; Cancel keeps the current identity unchanged,
  and confirmation invokes the backend reset.
- The app shell does not render a top command/search header or Alerts shortcut.
  Sidebar navigation and in-page links are the user-facing cross-workspace
  navigation surfaces.
- Evidence is a separate sidebar page between Projects and Schedules. It is the
  only broad historical evidence browser; Overview recent evidence opens
  Evidence focused on the selected evidence id.
- Identities is a separate sidebar page after Schedules and before App Settings.
  It lists workflow-owned current browser identities, shows managed identity
  posture/diagnostics/run context, and opens read-only historical references
  for old identity ids from evidence or rotation history.
- Scheduled runs use the latest saved workflow graph and saved Workflow Settings at fire time; unsaved workflow detail drafts are not run.
- Schedules run only while the Electron app process is active. Missed occurrences are skipped and recorded; the scheduler does not run catch-up backlogs.
- If a schedule fires while the same workflow is active, the same persistent browser profile is active, or a batch run is active, that occurrence is skipped with reason `active_workflow`, `active_profile`, or `active_batch`; one-time schedules are disabled after the skipped opportunity. Isolated schedules can start concurrently.
- Enabled schedules must have valid schedule config and a currently runnable saved workflow. Disabled draft schedules can point at workflows that are still being authored.
- Schedule event history records started, skipped, missed, failed-to-start, and disabled decisions independently from run evidence rows.
- Schedule history entries can open the owning Workflow target. A stale or
  deleted schedule target renders an unavailable target message.
- Workflow package export can include Flow, selected Workflow Settings
  sections, and subflows referenced by Call Subflow nodes. Export opens the
  native system Save dialog so users can choose the folder and file name.
  Export sanitizes machine-local or sensitive settings fields by default,
  including proxy passwords, credentials embedded in proxy URLs, and local
  fingerprint font directories. Package import recreates referenced subflows
  and remaps Call Subflow ids before saving the imported workflow graph.
- Workflow detail collapses the app sidebar into the icon rail when opened and
  exposes a compact header command bar. Settings, Validate, and Save are
  accessible icon controls with tooltips; Settings opens Workflow Settings at
  Browser Launch. `Launch Run` is the primary text action, Stop appears only
  while running, and Run from selected appears only when its workflow setting
  makes it relevant.
- Workflow Settings contains General, Graph, Run Policy, Browser Launch, and Environment sections. Related controls are grouped inside each section so users can scan settings by purpose. It is per-workflow and distinct from the app-level Settings screen. Settings are saved through a single dialog-level Save Settings action rather than separate section save buttons.
- Workflow Settings Browser Launch values are sourced from the workflow's
  selected project saved session or private workflow session at run time.
  Per-workflow settings remain the UI surface for run policy, graph defaults,
  and initial variables.
- Workflow Settings Run Policy exposes maximum workflow duration, browser retention, Allow Run JavaScript, and a grouped Run from selected control. When Run from selected is enabled, the group shows a scope select with `selected_only` for running only the selected node and `from_selected` for running from that node through the downstream main path. Batch concurrency, batch headless, and stop-on-first-failed-row values remain visible but disabled with a pause note until Batch Run UI is ready.
- Workflow Settings Graph exposes the new link wait default for newly created graph links in one grouped control. It supports no default wait, fixed duration milliseconds, or random min/max milliseconds, and changing it must not rewrite existing links.
- Workflow Settings Environment exposes initial variable values as typed rows for graph template/runtime context.
- Workflow Settings Browser Launch exposes browser identity controls. Each workflow has a stable read-only `identity_id`, editable display name, fixed CloakBrowser fingerprint seed, stored persona metadata, and optional fingerprint fonts directory. Backend-generated identities use high-entropy `bi_<32 hex>` ids. `profile_dir` remains internal storage metadata and is not shown as a separate Browser Launch field. The seed is always visible in the dialog; renaming the display name does not change profile storage, persona, or the fingerprint seed.
- Workflow Settings Browser Launch exposes Reset identity as the browser identity rotation control. Reset uses an in-app confirmation dialog, saves pending settings before invoking the backend reset command, creates a new backend-generated identity id/profile directory/fingerprint seed, records a migration-note audit event, preserves non-storage preferences such as proxy, locale, and fingerprint fonts directory, and disables Run from selected in Run Policy until a fresh retained session exists.
- Workflow Settings Browser Launch exposes a Reuse login session checkbox. Turning it on uses the identity's stable persistent browser profile; turning it off clears `profile_name` so the run uses temporary browser storage while keeping the same identity seed and disables Run from selected in Run Policy.
- Workflow Settings Browser Launch exposes the selected session's proxy URL/credentials/bypass, timezone, locale, detected local machine timezone/locale, GeoIP, fingerprint fonts directory, a Humanize browser input toggle, a Humanize preset select with `default` and `careful`, and headless launch controls. New project saved sessions and private workflow sessions enable GeoIP by default so blank timezone/locale fields resolve from the current public or proxy exit IP; blank legacy location settings normalize back to GeoIP. Running with GeoIP off requires explicit timezone and locale values. A stored persona from the catalog binds viewport/window dimensions, OS/browser bucket, region rationale, font bundle metadata, and timing profile for identity context.
- Workflow Settings validation warns operators when proxy-enabled identities lack explicit timezone/locale and GeoIP is off, and when a configured fingerprint fonts directory can create a stable font hash across identities. CloakBrowser diagnostics inspect configured font directories and report missing/unreadable directories, file counts, normalized hashes, expected family coverage, shared-directory warnings, and bounded approximate profile sizes instead of placeholder status.
- Set Viewport is an in-run viewport-size action. Active authoring exposes width and height only; Workflow Settings Browser Launch no longer exposes viewport width, viewport height, device scale factor, mobile viewport, or touch input controls.
- Workflow Settings saves, backend identity reset, and workflow deletion must reject browser identity profile reset/delete while a workflow/profile run is active or a retained browser session is still active for that workflow/profile.
- Identity Lab Close Retained Session closes only the matching in-memory
  retained browser context after backend guards pass. It must not delete
  profile data, cookies/login state, workflow settings, evidence, or
  historical runs.
- Identity Lab Reset Identity uses the existing guarded backend identity reset
  command with in-app confirmation and is unavailable while an active run or
  retained session blocks the backend command.
- Workflow Settings section help exposes a compact English/Vietnamese language toggle and uses nested collapsible sections for best-fit guidance, non-goals, precedence, field explanations, examples, related graph actions, common mistakes, and safety notes when present. Detailed field, example, related-action, and mistake items are also individually collapsible. It explains each section field in enough detail for an operator to decide what the field controls and when to use it.
- Closing Workflow Settings with unsaved edits asks whether to save and close, discard changes, or keep editing.
- Graph autosave is an app-level setting. It is enabled by default and can be changed from App Settings.
- App Settings includes current app-level graph autosave preferences,
  environment readiness diagnostics, guarded local maintenance commands, and
  graph shortcut guidance. It does not manage the project saved session and
  does not introduce notification or theme systems. Diagnostics display CloakBrowser,
  GeoIP, headed display, font, profile-count, and smoke readiness without raw
  binary/cache/profile/font paths.
- When graph autosave is enabled, graph edits save after changes. When disabled, users save graph edits manually.
- Running from the graph workspace saves the visible graph before execution.
- Running from the graph workspace saves dirty Workflow Settings sections before execution.
- Run from selected is a workflow-detail action. It is hidden unless enabled in Workflow Settings Run Policy, runs from exactly one selected main-path node using the retained browser session, saves visible graph/settings first, and is disabled unless Reuse login session is enabled, browser retention is `retain`, and the retained session matches the workflow/profile directory. Its Run Policy scope controls whether execution covers only the selected node or continues from that node through the downstream main path. Call Subflow nodes and nodes downstream from them are valid main-path selections when the referenced subflows are valid.
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
- The main graph toolbar exposes icon controls for undo, redo, select mode, pan mode, fit view, auto arrange, arrange selection, and shortcuts, plus New node, Add Action, Add Logic, Add Variable, and Add End. Toolbar-created nodes appear near the center of the currently visible canvas view instead of a fixed graph origin. Auto arrange repositions nodes through layered workflow layout into deterministic execution lanes, wrapping long main paths into left-to-right rows so large graphs stay reachable, and is part of graph undo history. Arrange selection is available for multi-node selections, keeps unselected nodes fixed, and is also part of graph undo history. It does not expose Add Output.
- The graph toolbar exposes a Shortcuts action that opens graph mouse and keyboard guidance without leaving the workspace.
- Add Logic stays beginner-focused: Branching, Loops, Recovery/Retry, and
  Reuse are visible for workflow graphs. Branching includes If, Switch, Router,
  and Merge. Reuse includes Call Subflow. Subflow graphs hide Call Subflow in
  the Add Logic palette.
- Add Action uses semantic groups and user-intent labels. User-facing labels may differ from serialized action types, for example Fill Field still saves as `input_text`.
- Targetable action editors default Target locator type to XPath, while still allowing Test ID, Role, Label, Placeholder, Text, CSS, and Attribute locators.
- Targetable single-target action editors expose Target source as an exclusive choice. Use locator shows target locator fields; Use Find Element ref hides locator fields and shows only Target ref so operators do not mistake locator visibility/text/index constraints as active while using a runtime ref.
- Action and graph-native logic inspectors group related multi-field controls so operators can scan what belongs together: targets, entered content, output names, match values, mode-specific fields, artifacts, runtime policy, loop guards, retry policy, router cases, random choices, and terminal behavior are separated by named groups. Single-field actions such as Press Key, Hotkey, and Set Clipboard remain ungrouped.
- Drag and Drop authoring exposes `Drag source` as its own group and `Drop setup` as the group for `Drop target` plus `Drop point`; source and target locator labels must stay distinct so operators do not confuse the element being dragged with the place it lands.
- Scroll authoring exposes Page Scroll, Scroll To Element, and Scroll Until Element Visible labels while preserving the serialized `page`, `into_view`, and `until_element_visible` modes. Page Scroll shows Scroll style, Direction, and Pixels; Scroll style defaults to Human-like and can switch to Smooth single wheel. Scroll To Element supports Use locator or Use Find Element ref, optional Iframe XPath, and Timeout ms defaulting to `60000`; Scroll Until Element Visible shows locator target, timeout, Direction, and Pixels for the repeated page-scroll search gesture without low-level target constraint fields.
- Browser identity belongs in the project saved session/private workflow session
  and Workflow Settings Browser Launch. Launch-time identity settings are not
  represented as in-run action nodes in the current workflow contract.
- Subflows are reusable graph fragments, not standalone runnable scenarios.
  They are reachable from the selected project's Subflows collection, can be
  created, opened, saved, duplicated, and deleted, and show usage warnings when
  referenced by workflows. Deleting a referenced subflow is blocked.
- Call Subflow nodes run a same-project subflow inside the caller's existing
  run, browser context, output store, evidence path, and retention policy. MVP
  subflows cannot call other subflows.
- The Wait action group includes fixed Wait and Random Wait actions. Random Wait requires minimum and maximum milliseconds, with maximum greater than or equal to minimum. Link waits use the same duration constraints but stay scoped to the edge transition.
- Graph canvas nodes show the saved node label as the primary text and keep the underlying action or graph-node kind visible as secondary text. Compact metadata may appear after the kind when it helps identify the node, but full configuration details remain in the inspector.
- Selecting a graph link clears node selection and shows link-scoped actions, including none/fixed/random link wait editing. Selecting a node clears link selection and shows node-scoped inspector content.
- Selected non-start graph nodes expose a Node name field in the inspector. Renaming updates the node label used on the canvas, saved graph, compiled step labels, run traces, and node-linked error context without changing the node type or config.
- Multi-selecting graph nodes or links shows a selection summary with bulk duplicate, copy, and delete actions. Bulk edits never delete, copy, paste, or duplicate the `start` node. Duplicate and paste create fresh ids and only preserve internal links inside the selected/copied fragment.
- Graph undo/redo applies to graph edit snapshots only. Run state, validation results, save status, settings, and workflow metadata are not part of graph undo history.
- Graph editor keyboard shortcuts only fire after the graph workspace is active through pointer or focus interaction, and they do not fire while focus is inside inputs, textareas, contenteditable elements, action/node palettes, help dialogs, or dropdown popovers.
- Dragging empty graph canvas creates a selection box by default. Holding Space temporarily switches the canvas to pan mode, and the toolbar pan hand can keep pan mode active until select mode is chosen again.
- Dragging a graph node starts from the node body itself; graph ports remain the only dedicated targets for creating links.
- Selected graph nodes expose detailed schema-backed help from the inspector. Configured action nodes show an action guide popup with a compact header language toggle, collapsible parent sections, ports and flow, minimum setup, detailed field and option explanations grouped by collapsible required/optional/advanced child groups, output guidance, workflow examples, and safety notes when relevant. Individual field, option, output, and example items are collapsible below those groups. Graph-native nodes explain purpose, ports and flow before minimum setup, grouped field and option explanations, related nodes, and workflow examples in the same popup format. The inspector does not repeat a separate Connections summary because graph port hover tooltips and node Help own connection guidance. Common mistake guidance appears inside relevant field or option details, not as a separate top-level section.
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
- App Settings is a separate app screen reachable from the sidebar.
- Schedules is a separate app screen reachable from the sidebar.
- Evidence is a separate app screen reachable from the sidebar. It lists only
  typed persisted evidence summaries and bounded typed details for screenshot,
  download, browser identity, action trace, and evidence manifest items. It
  does not expose raw arbitrary output browsing. Identity evidence opens
  read-only Identity Lab historical context tied to the evidence run.
- Identities is a separate app screen reachable from the sidebar. It receives
  sanitized Identity Lab DTOs and does not expose raw profile paths, browser
  storage, cookies, tokens, proxy credentials, absolute local font/binary paths,
  or raw arbitrary run outputs.
- App Settings includes graph shortcut guidance for navigation, selection, editing, run, and save controls.
- On/off settings use the shared switch treatment. Compact exclusive choices such as Help language and Variables Rows/JSON use the shared segmented-control treatment with a clear active state.
- User-facing layout and styling changes follow `DESIGN.md`.
- Mission Control must remain usable at compact desktop widths such as
  1024x768 without horizontal page overflow; table interiors may keep their own
  bounded horizontal scrolling.
- Command errors are shown as readable messages.
- Workflow detail shows graph save state such as saved, unsaved changes, saving, autosave failed, or autosave off without raw workflow `updated_at` metadata in the detail controls row.
- Workflow detail full graph execution is exposed as `Launch Run` and invokes the existing save/settings/validation/run pipeline directly. `Run from selected` remains the direct retained-session debugging command.
- Workflow detail header command actions stay in a single row at desktop widths; compact-width layouts may wrap them to avoid horizontal overflow.
- Workflow Settings Graph defaults Live Run on and Follow current off. Disabling Live Run hides the workflow detail live run navigator; enabling Follow current sets the default auto-focus behavior for the navigator.
- Workflow detail opens the graph canvas with no selected node or link so the
  canvas can use the full workspace width. Selecting a node, link, or multi-item
  selection opens the graph inspector as a right-side drawer over the canvas;
  closing the drawer clears the graph selection.
- A real manual full-run launch attempt blocked by graph or Workflow Settings
  validation before browser launch creates one sanitized durable
  `launch_blocked` attention item visible on Overview. Manual Validate alone
  does not create attention.
- Running a graph shows status in the page header, displays a live run navigator with a chronological node-activity log timeline, and reflects graph progress through canvas node state. Each node occurrence is one timeline row whose status changes from running to completed or failed; future pending graph nodes do not appear in the log, and timeline rows do not visually activate just because the graph current node is active. Follow current is configured in Workflow Settings and can automatically select and center the current graph node, while timeline row selection performs graph focus on demand.
- Run issues distinguish blocking graph validation issues, runtime failures, and system/startup errors. Issues with graph context can select the affected node or link.
- Runtime and system run issues keep the long raw error collapsed behind Details, expose Copy details, and show only a short contained summary by default. The graph inspector drawer mirrors the selected node's last run error with the same collapsed-details behavior so long Playwright/CloakBrowser messages do not overflow the workspace.
- Run issues remain visible while users interact with or edit the graph. When an edit may have made the issue results stale, the issue panel must say the issues need recheck instead of disappearing silently.
- Graph run colors are semantic: green is reserved for completed/successful paths, cyan/blue indicate selection or active execution, amber indicates validation issues, and red indicates failure. The currently running node uses a prominent cyan border, tinted fill, ring, and glow so active execution remains visible on large dark graphs.
- Selecting a graph node or link must not replace amber validation or red failure color with cyan selection color. Selection can add a secondary ring or emphasis while preserving the issue/failure color.
- Graph links expose editor-only visual kinds for main path, branch, continuation, loop, and recovery routing. These kinds may adjust stroke weight or pattern, but failed, validation issue, running, selected, and completed semantic states take visual priority.

## Command Boundary

- Electron IPC command errors serialize as `{ message, field? }`.
- Renderer code calls the typed `window.workflowApi` bridge through `src/lib/workflowApi.ts`.
- The renderer must not import Node, Electron, filesystem, SQLite, Playwright, or CloakBrowser APIs directly.

## Runner Behavior

- Full runs execute the compiled saved graph.
- Full runs launch through CloakBrowser/Playwright in the Electron backend by default, with humanized interaction enabled by default. Setting `AUTOMATION_BROWSER_ENGINE=camoufox` selects the local Camoufox Firefox-compatible runtime for lab runs and records that engine in browser identity evidence.
- Full runs use persisted Workflow Settings as the run baseline. Browser Launch identity settings, including profile directory, fingerprint seed, fingerprint fonts directory, proxy, explicit or detected local timezone/locale, supported WebRTC IP policy values, humanize toggle/preset, and headless mode, are resolved before browser launch. New or lazy backend defaults auto-fill the repo-local `.local/cloakbrowser-fonts/linux` bundle when it exists and is readable, while an operator-cleared `fingerprint_fonts_dir: null` remains cleared. Persona viewport/window dimensions are recorded in identity evidence; Browser Launch does not send explicit Playwright `viewport`, `--window-size`, or CloakBrowser screen-size overrides. Environment initial variables are applied before the first graph step; saved edge waits compile into synthetic wait steps before target nodes; Run Policy max duration cancels and fails overlong runs with a timeout reason, and Run Policy can reject Run JavaScript before page script evaluation.
- Set Viewport updates runtime viewport width and height only.
- Headed CloakBrowser runs on Linux fail with a clear display prerequisite message when no `DISPLAY` or `WAYLAND_DISPLAY` is configured.
- Domain allowlist graph nodes become a run-scope navigation policy. Disallowed Navigate/Open New Tab URLs fail after template rendering and before browser navigation.
- Browser identity profile directories persist Chromium user data under the user's app data directory so login/session state can survive app and OS temp cleanup. Runs without persistent session reuse use temporary browser storage but still keep the configured identity seed unless the operator explicitly resets or duplicates the identity.
- Missing Workflow Settings rows return lazy v2 defaults.
- Stop returns a stopped state immediately for the targeted run id; active workflow/profile ownership clears after the runner finishes cancellation.
- Different workflows can run concurrently when they do not share a persistent browser profile. Same-workflow runs, shared persistent-profile runs, and batch conflicts are rejected with readable command errors.
- Batch runs remain globally exclusive with normal runs, can be stopped through Stop, and expose progress/summary in run outputs.
- Browser sessions remain open after success, failure, and stop by default. Workflow Settings Run Policy browser retention can close the browser by default, and terminal End Success, End Failure, or Stop Workflow nodes can explicitly request closure.
- Failures identify the failed step when possible.
- Screenshots, downloads, and failure screenshots are written under run-scoped evidence directories and surfaced through structured `__evidence` metadata.
- Evidence artifact preview/reveal/export commands accept evidence ids, not
  paths. The backend resolves the item from persisted metadata, validates it is
  under `evidence/runs/<run_id>/...`, and never returns absolute original paths
  to the renderer. Downloads are not previewed or executed in-app.
- `browser_identity` output evidence includes a fingerprint seed hash, configured fingerprint font hash when available, sanitized persona metadata/rationale, timezone/locale source, supported WebRTC policy, active advanced override names such as `fingerprint_fonts_dir`, configured humanization status and preset, and CloakBrowser wrapper/binary version evidence.
- Graph runs use the same run-state contract as workflow runs. When compiled graph node ids are present in run state, the canvas reflects current/completed/failed nodes.

## Persistence

- Workflow summaries include list metadata only; saved graph JSON is keyed by workflow id.
- Graph saves touch the parent workflow `updated_at`.
- Saved Workflow Settings are keyed by workflow id and touch the parent workflow `updated_at`. Saving General also updates the workflow summary name.
