# Project And Subflow Invariants

Preserve these unless the task explicitly changes them.

## Projects

- Auto-created default project named `Main`.
- Creating a project creates a workflow named `Main` using its first browser profile.
- Projects workspace header: Import project next to Create Project.
- Project list sidebar: search/filtering + project selection.
- Selected project shows Workflows, Subflows, Profiles, Settings as fixed tabs.
- Scoped to selected project; changing project resets detail tabs to Workflows.

## Profiles Tab

- Scoped browser profiles list showing used counts, session statuses, and recent failures.
- CRUD: add profiles, rename inline, delete unused after confirmation.
- Editable configuration options for the selected profile: Proxy (enabled, server, username, password), Timezone/Locale (with GeoIP toggle), WebRTC policy, Headless mode, Humanize settings (with presets), and Custom Fonts directory.

## Project Settings

- `Project identity` heading, `Project details` group.
- Project details: editable name, Save, Duplicate project, Export project, Delete project.
- Duplicate: independent copy with copied workflows/subflows, remapped Call Subflow refs, fresh identities/profiles.
- Export: `.project.json` via native Save dialog, sanitized sensitive/local Browser Launch fields.
- Import: previews package, creates new project, remaps ids, fresh identities. Does NOT import: runs, evidence, schedules, app settings, browser profile storage.
- Delete: in-app confirmation warning. Rejected while active run/retained session in project.

## Browser Profiles

- Backend-generated `bi_<32 hex>` identity ids.
- Internal persistent profile directories.
- Deterministic CloakBrowser fingerprint seeds + stored persona metadata.
- Editable Proxy/location posture, humanization, headless, WebRTC, and custom fonts.
- Browser launch configuration is managed and editable per browser profile in the Profiles tab, and selected by workflows.
- Profile deletion rejects while selected by active run or retained session.
- New profile = new identity (user-facing route to new browser identity).

## Subflows

- Reusable graph fragments, not standalone runnable scenarios.
- Reachable from selected project's Subflows collection.
- CRUD: create, open, rename via Subflow Settings, save, duplicate, delete.
- Usage warnings when referenced by workflows. Deleting referenced subflow is blocked.
- Subflow detail: owning project name in header, Settings opens rename, Save disabled until content changes.
- Duplicate/delete actions stay on collection list, not detail header.

## Call Subflow

- Runs same-project subflow inside caller's run/browser context/output store/evidence/retention.
- MVP subflows cannot call other subflows.
- Empty subflow: validation/run stops at Call Subflow node (no skip to next).
- Open subflow: from node inspector actions and context menu, opens without saving workflow.
- Back from subflow detail returns to originating workflow detail.
- Add Subflow toolbar picker: `Call subflow` (default) creates linked node; `Insert nodes` copies real nodes.

## Navigation And App Shell

- Sidebar order: Overview, Projects, Schedules, Setting.
- Overview is default first screen (includes System Health diagnostics widget).
- No top command/search header or Alerts shortcut.
- Sidebar and in-page links are cross-workspace navigation surfaces.
- Setting: collapsible navigation group containing:
  - General: autosave prefs, maintenance commands.
  - Help: XPath cookbook, graph shortcuts.
- No notification/theme systems.

## UI Primitives

- On/off settings: shared switch treatment.
- Compact exclusive choices: shared segmented-control with clear active state.
- Layout/styling follow `DESIGN.md`.
- Compact desktop (1024x768): no horizontal page overflow; table interiors may keep bounded scrolling.
- Command errors shown as readable messages.
- Icon-only controls: accessible labels + visible tooltip text.
