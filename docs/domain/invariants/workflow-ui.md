# Workflow UI Invariants

Preserve these unless the task explicitly changes them.

## Workflow List

- Blank workflow names are rejected.
- List cards do not show project environment/session labels.
- List `Edit` opens Workflow Settings at General.
- Row actions: icon-only with accessible labels — View Details, Run, Edit, Duplicate, Export, Delete.
- Duplicate: `Copy of <name>`, preserves graph + non-storage settings + selected profile, disables Run from selected.
- Deletion: in-app confirmation dialog (not browser `confirm`), asks keep/delete private profile data (delete checked by default), removes only unshared inactive profile dirs. Rejected while running, profile active, or retained session active.
- List Run: executes saved graph + saved settings without opening detail. Disabled only for active-run workflow. Duplicate/Export/Delete disabled until terminal state.
- Import Workflow: rejects >5 MB, shows preview, creates new workflow in selected project. Never overwrites existing workflow/profiles or leaves partial workflow.

## Workflow Detail

- Opens with sidebar collapsed to icon rail.
- Compact header: project name in metadata, Settings/Validate/Save as icon controls with tooltips.
- Settings opens Workflow Settings at Browser Launch.
- Save disabled when no content changes; enables on change or failed autosave retry.
- `Run` is primary text action; Stop appears only while running; Run from selected is always shown (but is disabled if prerequisites are not met).
- Header actions: single row at desktop widths; compact layouts may wrap.
- Graph save state shown (saved/unsaved/saving/autosave failed/autosave off) without raw `updated_at`.
- `Run` invokes save/settings/validation/run pipeline. `Run from selected` is retained-session debug command.
- Running saves visible graph and dirty settings before execution.
- If graph save or settings save fails, run does not start.
- Blocked launch attempt creates one `launch_blocked` attention item on Overview. Manual Validate alone does not.

## Run Status

- Compact status signal in header; live run navigator with chronological activity log timeline.
- Canvas reflects node progress: running/completed/failed.
- Each timeline row = one node occurrence; future nodes not shown; rows don't activate from graph current-node alone.
- Follow current: auto-select/center current node (configured in Workflow Settings).
- Run issues distinguish validation, runtime failures, and system errors. Issues with graph context can select affected node/link.
- Runtime failures name failed step path + subflow step number/count + action type + context (locator, URL, duration).
- Call Subflow failures highlight the Call Subflow node on main graph.
- Long raw errors collapsed behind Details with Copy details.
- Issues remain visible during edits; stale issues show recheck message.

## Run from Selected

- Always visible in the workflow detail header.
- Displays a dropdown offering two execution scopes: "Only rerun selected node" and "Run from selected node onward".
- Runs from one selected main-path node using retained session.
- Saves graph/settings first.
- Disabled unless: persistent profile, retention = `retain`, retained session matches workflow/profile.
- Scope: `selected_only` or `from_selected` (downstream main path).
- Call Subflow nodes and downstream nodes are valid selections.
- Stale retained browser: unavailable or readable error, never silently launches new browser.

## Workflow Settings

- Contains: General, Graph, Run Policy, Browser Launch, Environment.
- Per-workflow, distinct from app-level Settings.
- Saved through single dialog-level Save Settings action.
- Closing with unsaved edits: save and close / discard / keep editing.
- Section help: English/Vietnamese toggle, collapsible nested sections.

### Browser Launch
- Selects one browser profile from workflow's project.
- Does NOT expose: session-source, identity cloning, identity id, fingerprint seed, Reset identity, proxy/location, humanize, launch controls.
- New browser profile = new identity (user-facing route).

### Run Policy
- Max duration, browser retention, Allow Run JavaScript, grouped Run from selected control.
- Batch values visible but disabled until Batch Run UI ready.

### Graph
- New link wait default: no wait / fixed ms / random min+max ms.
- Live Run defaults on, Follow current defaults off.
- Changing default must not rewrite existing links.

### Environment
- Initial variable values as typed rows for template/runtime context.

### Validation
- Warns on proxy identity without timezone/locale when GeoIP off.
- Warns on fingerprint fonts directory creating stable hash across identities.
- Reject profile reset/delete while run active or retained session active.

## Graph Autosave

- App-level setting, enabled by default, changed from App Settings.
- When enabled: auto-save after changes. When disabled: manual save.
- Leaving detail with unsaved edits: Save and close / Discard / Keep editing (only when autosave off or autosave failed).

## Package Export/Import

- Export: Flow + selected Settings sections + referenced subflows. Native Save dialog.
- Export sanitizes: proxy passwords, URL credentials, local font dirs.
- Import: recreates subflows in selected project, remaps Call Subflow ids.
- Importing Browser Launch creates private imported profile (not rewriting existing).
