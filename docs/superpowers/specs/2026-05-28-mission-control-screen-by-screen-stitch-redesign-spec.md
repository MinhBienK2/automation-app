# Mission Control Screen-By-Screen Stitch Redesign Spec

Date: 2026-05-28

## Status

Drafted for user review.

This is a design-only specification for using Stitch to redesign the current
Mission Control UI in detailed screen passes. It does not authorize runtime
behavior changes, backend changes, new IPC commands, new persistence models, or
new security scope.

## Goal

Generate a complete, detailed Stitch redesign plan for every implemented
Mission Control workspace and shared UI surface, screen by screen.

The redesign must improve layout quality, component consistency, popup/dialog
treatment, button hierarchy, table density, form clarity, error states,
compact-desktop behavior, and overall operator experience while preserving the
existing Mission Control design system and product behavior.

## How To Use This Spec In Stitch

Use one Stitch generation or edit prompt per screen. Do not ask Stitch to
redesign the whole app in one prompt. Each prompt must preserve the shared
design system and focus on the named screen or component group only.

Recommended order:

1. App shell and shared component language.
2. Overview.
3. Workflow Library.
4. Graph Builder.
5. Workflow Settings Dialog.
6. Recording Review and action/helper popups.
7. Runs.
8. Evidence Explorer.
9. Identity Lab.
10. Schedules.
11. App Settings.
12. Cross-screen responsive and CSS polish pass.

For each Stitch pass, request desktop `1440x1024` plus compact desktop
`1024x768`. Do not request a phone-first layout.

## Required Design System

Use the existing Mission Control design system exactly unless a screen prompt
states a narrow exception.

### Visual Character

Mission Control is a dark, precise desktop operations workspace for repeated
authorized automation work. It must feel like a dense internal operations
console, not a marketing dashboard.

### Tokens

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#0B1016` | Main app background. |
| Sidebar / inset | `#0E151D` | Sidebar, rail, deep inactive regions. |
| Surface | `#121C26` | Panels, tables, cards, graph tools. |
| Elevated surface | `#172431` | Dialogs, active details, popovers. |
| Border | `#233240` | Default boundaries. |
| Emphasized border | `#314758` | Hover and stronger separation. |
| Primary text | `#E7EEF5` | Titles and core data. |
| Secondary text | `#9AAEBD` | Supporting text and labels. |
| Muted text | `#667D8D` | Metadata and disabled content. |
| Active/control cyan | `#32D3E6` | Focus, selection, primary execution. |
| Success green | `#39D98A` | Successful terminal states only. |
| Attention amber | `#F4B740` | Warnings, stale state, validation. |
| Failure red | `#F06467` | Runtime/system failures and destructive actions. |

Do not use green as the brand or primary button color. Do not use color alone
for state; pair status color with readable labels and icons.

### Typography And Density

- UI font: Inter or a close modern sans-serif.
- Monospace: run ids, timestamps, identity ids, paths, technical values, JSON,
  and serialized details.
- Page titles: `28-32px`.
- Section headings: `18-20px`.
- Body, labels, and controls: `13-14px`.
- Metadata: `11-12px`.
- Letter spacing: `0`.
- Spacing rhythm: `4px` and `8px`.
- Radius: controls, panels, cards, and repeated regions max `8px`; dialogs max
  `12px`.
- No decorative nested cards. Use cards only for repeated records, focused
  tools, dialogs, and popovers.

## Current UI Issues To Fix

Use these as redesign targets, not as blame notes.

1. Header hierarchy is inconsistent across workspaces. Some pages have only a
   title, some have status/meta/actions, and some let error text sit inside the
   header flow.
2. Main actions and secondary actions are not always visually ranked. For
   example `Launch Run`, `Create Workflow`, `Record Workflow`, import/export,
   stop, and refresh need a consistent hierarchy.
3. Workflow Library uses card rows, but the row actions are dense icon clusters
   without a strong selected-row preview or scalable metadata treatment.
4. Graph Builder is functionally strong but visually crowded: toolbar, canvas,
   issue panel, inspector, header, and run controls compete for attention.
5. Long runtime/system error details can threaten layout stability. Summary,
   details, copy action, and graph focus actions need a more deliberate visual
   pattern.
6. Dialogs exist in several sizes but do not share a strong modal anatomy:
   header, description, content scroll region, sticky footer, close affordance,
   danger confirmation, and unsaved state should feel unified.
7. Recording Review still contains legacy neutral/green-black styling that does
   not fully match Mission Control tokens.
8. Some tables and definition lists need stronger dense-data treatment:
   headers, row hover, selected/focused row, status pill, technical value, and
   overflow wrapping.
9. Evidence, Identity, and Run detail screens need stronger master-detail
   layouts with clear traceability actions.
10. Empty, loading, warning, stale target, and failure states need a shared
    component language instead of isolated text blocks.
11. Compact `1024x768` behavior needs screen-specific decisions: hide secondary
    metadata first, keep table interiors scrollable, collapse sidebar to an
    icon rail, keep dialogs inside the viewport, and avoid page-level
    horizontal overflow.
12. CSS polish should reduce one-off hard-coded colors, old neutral blacks,
    mismatched greens/ambers, and inconsistent radius/spacing.

## Shared Component Requirements

Apply these to every screen prompt.

### Buttons

Define a strict button hierarchy:

- Primary: one main command per screen or dialog. Use cyan border/focus
  treatment with strong readable text. Examples: `Launch Run`, `Create
  Workflow`, `Save Settings`, `Export Selection`, `New Schedule`.
- Secondary: normal operations such as `Refresh`, `Open Workflow`, `Open
  Evidence`, `Record Workflow`, `Validate`, `Save`, `Import Workflow`.
- Destructive: red treatment for `Delete`, `Stop`, `Reset Identity`, and
  destructive profile/session actions.
- Icon-only: only for dense tools and repeated row actions; every icon-only
  button needs tooltip text and accessible label.
- Disabled: preserve layout, reduce opacity, and show why the action is
  disabled through title/tooltip/help text when consequential.

Do not make every button pill-shaped. Use compact `6-8px` radii. Use icon plus
text for consequential actions.

### Status Pills

Every status pill must use:

- A short readable label.
- An optional small icon or dot.
- Semantic color border/text.
- Neutral background using existing surfaces.

Required tones:

- Active/running: cyan.
- Success/completed: green.
- Attention/stale/recheck: amber.
- Failure/destructive: red.
- Idle/disabled: secondary/muted.

### Dialogs And Popups

All dialogs use the same anatomy:

- Overlay: dark translucent overlay, subtle blur only.
- Surface: `#172431` or `#0B1016` depending on density, `12px` max radius,
  `#314758` border.
- Header: eyebrow when helpful, title, concise description, close icon.
- Body: scrollable when content exceeds viewport.
- Footer: sticky when body scrolls, primary action first visually, secondary
  actions grouped, destructive action clearly separated.
- Widths: small confirmation `420-520px`, medium form `560-720px`, large
  workflow settings or palettes `920-1040px`, all clamped to
  `calc(100vw - 48px)` and `calc(100dvh - 48px)`.

Required popup types:

- Create/edit workflow.
- Delete workflow and profile-data choice.
- Launch Run confirmation.
- Workflow Settings.
- Add Action/Add Logic palette.
- Step Help / Action Help.
- Recording Review.
- Schedule create/edit.
- Schedule history.
- Identity reset confirmation.
- Unsaved changes confirmation.

### Forms

Forms must use:

- Visible label above every field.
- Help text below field when the setting is risky or non-obvious.
- Inline validation message directly below the field.
- Field groups with clear group titles for related controls.
- Switches for binary choices.
- Segmented controls for compact mutually exclusive choices.
- Selects for option lists.
- Tables/rows for variable rows and repeated schedule/evidence/identity
  metadata.

### Tables And Lists

Dense operational tables must use:

- Sticky or clearly separated header row.
- Monospace ids and timestamps.
- Row hover and selected/focused state.
- Status pill column.
- Primary entity label in first content column.
- Secondary metadata hidden first at compact width.
- Bounded horizontal scroll only inside the table wrapper.

### Empty, Loading, Error, And Stale States

Create shared state components:

- Loading: compact skeleton rows or stable reserved blocks; no layout jump.
- Empty: title, one-sentence reason, one real action when available.
- Warning: amber icon, short title, contained explanation.
- Error: red icon, short summary, retry/copy details action when useful.
- Stale target: safe identifier, explanation, return/open-list action.

## Screen Prompt 1: App Shell And Command Bar

Use this prompt first.

```text
Redesign the Mission Control Electron desktop app shell as a dark, precise
operations workspace using the provided design system.

DESIGN SYSTEM REQUIRED:
- Canvas #0B1016, sidebar/inset #0E151D, surface #121C26, elevated surface
  #172431, border #233240, emphasized border #314758.
- Text #E7EEF5, secondary #9AAEBD, muted #667D8D.
- Cyan #32D3E6 for focus, selection, command/search, and active execution.
- Green #39D98A only for successful terminal states.
- Amber #F4B740 for warnings/stale/validation.
- Red #F06467 for failures and destructive actions.
- Inter typography, compact desktop scale, 8px max radius for panels/controls.

Screen: App shell at 1440x1024 and compact desktop 1024x768.

Layout:
1. Left sidebar is the stable anchor with Mission Control logo/title,
   navigation in this order: Overview, Workflows, Runs, Evidence, Schedules,
   Identities, Settings.
2. Active nav item has cyan text/border and a subtle surface wash. Inactive
   items are quiet and scannable.
3. Sidebar supports collapsed icon rail at compact width. Icon-only rail items
   need tooltip labels.
4. Main content has a sticky command bar with current page label, Local Lab
   status badge, global search input, and Alerts button.
5. Search results popover is a dense command menu with result type, primary
   label, context, empty state, and selected/hover state.
6. Alerts button shows count as an amber badge when nonzero.
7. Keep all content below the command bar within a stable scrollable main
   region. No page-level horizontal overflow.

Fix details:
- Make spacing tighter and more consistent than a marketing dashboard.
- Keep the command bar readable at 1024x768 by stacking or shrinking search
  before hiding critical navigation.
- Use icon + label in the full sidebar; use icon-only with tooltip in the
  collapsed rail.
- Do not add decorative gradients, hero content, or onboarding copy.
```

Acceptance checks:

- Sidebar order matches the product invariant.
- Overview is visually plausible as the default entry.
- Compact desktop does not overflow horizontally.
- Command search popover has loading, empty, and result states.

## Screen Prompt 2: Overview

```text
Redesign the Mission Control Overview workspace as the default operations
dashboard for authorized browser automation runs.

Use the Mission Control design system exactly. This is a dense operations
workspace, not a marketing dashboard.

Layout at 1440x1024:
1. Page header:
   - Eyebrow: Operations Dashboard.
   - Title: Overview.
   - Subtitle: local-day/timezone and last refreshed timestamp.
   - Actions: Refresh Overview (secondary), Open Workflows (secondary or
     primary only if no active attention exists).
2. KPI row with four stable metric cards:
   - Active Runs (cyan).
   - Succeeded Today (green).
   - Attention Needed (amber).
   - Upcoming Schedules (neutral).
   Each card includes label, value, small context text, and optional icon.
3. Main grid:
   - Live Operations panel.
   - Attention Queue panel.
   - Execution Activity panel.
   - Recent Evidence panel.
   - Upcoming Schedules panel.
4. Attention Queue must be visually scannable and severe items must show
   type, workflow, short reason, status/severity pill, and open-target action.
5. Live Operations rows show workflow, identity, current step, elapsed time,
   source, and status.
6. Execution Activity is compact and data-dense; use bars/timeline buckets with
   legend for success, failed, blocked, schedule attention.
7. Recent Evidence rows include artifact type, workflow, relative safe label,
   timestamp, and open evidence action.
8. Upcoming Schedules rows include schedule name, workflow, next run, last
   status, and open schedule action.

States:
- Loading uses skeleton metric cards and rows.
- Error uses a red contained alert with Retry.
- Empty panels use quiet empty states without oversized illustrations.
- Focused Attention state shows a subtle focus banner/chip and a clear focus
  affordance.

Compact 1024x768:
- KPI cards become two columns.
- Main grid becomes one or two columns based on available width.
- Hide secondary row metadata first; keep primary labels and status visible.
```

Acceptance checks:

- Attention items are easier to scan than the current plain list.
- Metrics have stable dimensions and no layout jump while loading.
- Empty/error states are consistent with the shared state language.

## Screen Prompt 3: Workflow Library

```text
Redesign the Workflows screen as a workflow library and management workspace.

Use current capabilities only: list workflows, create, record, import, view,
run saved workflow, stop active workflow, edit settings, duplicate, export,
delete.

Layout at 1440x1024:
1. Header:
   - Eyebrow: Mission Control Workspace.
   - Title: Workflows.
   - Summary chips: workflow count, active run count when available.
   - Actions: Import Workflow, Record Workflow, Create Workflow. Create is the
     strongest action.
2. Library region:
   - Prefer a dense table/list hybrid over large cards.
   - Columns/fields: workflow name, active run status, last session status when
     available, schedule/identity context if available, and row actions.
   - Row primary action opens detail by clicking the row title or View icon.
   - Active workflow row shows running status and scoped Stop button.
3. Row actions:
   - View Details, Run, Stop when active, Edit, Duplicate, Export, Delete.
   - Use icon-only with tooltips for dense row actions.
   - Disable Run/Duplicate/Export/Delete for active workflow rows with clear
     disabled reason.
4. Optional selected preview area:
   - If space allows, add a right preview panel showing selected workflow
     context, recent run status, identity summary, and primary shortcuts.
   - Do not invent unavailable data; use sample labels only for design
     examples.
5. Empty state:
   - "No workflows yet" with Create Workflow as the primary action and Record
     Workflow as a secondary action.

Dialogs from this screen:
- Create Workflow dialog.
- Edit Workflow dialog.
- Import package preview.
- Export package options.
- Delete workflow/profile-data confirmation.

Compact 1024x768:
- Row action icons wrap into a stable action strip.
- Hide secondary metadata first.
- Preview panel becomes a collapsible drawer or disappears.
```

Acceptance checks:

- Main workflow actions are ranked clearly.
- Icon clusters are understandable with tooltips.
- Create/edit dialogs match shared modal anatomy.
- Active-run row behavior is visually scoped to one workflow.

## Screen Prompt 4: Graph Builder

```text
Redesign the Workflow Detail / Graph Builder workspace for authoring and
running visual automation graphs.

Use current behavior only: edit graph, add/connect nodes, inspect node/link,
save, validate, launch full run, run from selected when eligible, record
replacement, stop active run, show validation/runtime issues, show graph save
state and run progress.

Layout at 1440x1024:
1. Header:
   - Breadcrumb/back to Workflows.
   - Workflow name with ellipsis handling.
   - Save status chip: saved, unsaved changes, saving, autosave failed, or
     autosave off.
   - Run status bar with active/idle/failure state.
   - Actions: Settings icon, Validate icon, Save icon, Run from selected when
     visible, Record Replacement, Launch Run primary, Stop destructive when
     running.
2. Issue panel:
   - Place below header and above graph only when issues exist or stale
     recheck status exists.
   - Group blocking validation, runtime failure, and system/startup errors.
   - Each issue row shows severity, summary, affected node/link when present,
     and actions: Go to node/link, Validate again, Save again, Run again, Copy
     details where relevant.
   - Long raw error details stay collapsed.
3. Graph workspace:
   - Toolbar at top of graph region with icon tools: undo, redo, select mode,
     pan mode, fit view, auto arrange, shortcuts.
   - Creation buttons: New node, Add Action, Add Logic, Add Variable, Add End.
   - Central React Flow canvas with subtle cyan grid, visible ports, zoom
     controls, minimap, and stable canvas height.
   - Right inspector for selected node/link. It should feel like a tool panel,
     not a card nested in a card.
4. Inspector:
   - Empty selection state explains what to select.
   - Node selected: show node title/type, status, config fields, action guide
     button, run error summary if applicable.
   - Link selected: show link wait editor, source/target, and link actions.
   - Multi-selection: show count and bulk duplicate/copy/delete actions.
5. Graph node states:
   - Selected: cyan secondary ring.
   - Running: cyan active indicator.
   - Completed: green status only after success.
   - Validation issue/stale: amber border/status.
   - Failed: red border/status.
   - Selected failed/issue node keeps red/amber state and adds cyan secondary
     ring; do not replace the problem color.

Dialogs/popups:
- Launch Run confirmation.
- Add Action/Add Logic/Add Variable palette.
- Shortcuts dialog.
- Step Help/Action Guide.
- Node/link context menu if represented.

Compact 1024x768:
- Inspector becomes a right drawer or bottom panel.
- Toolbar wraps without changing canvas width.
- Canvas remains usable with no page-level horizontal overflow.
- Palettes fit inside viewport and scroll internally.
```

Acceptance checks:

- Header commands no longer compete visually.
- Issue panel remains visible while editing and has a stale/recheck state.
- Graph canvas, toolbar, and inspector each have clear boundaries.
- Node state color semantics match the invariant.

## Screen Prompt 5: Workflow Settings Dialog

```text
Redesign the Workflow Settings dialog as a large, dense, structured settings
workspace.

Use current sections only: General, Graph, Run Policy, Browser Launch,
Environment. Preserve dialog-level Save Settings and unsaved close protection.

Layout:
1. Large modal: width 920-1040px, height clamped to viewport.
2. Header:
   - Eyebrow: Workflow Settings.
   - Title: workflow name or section title.
   - Dirty/save status.
   - Save Settings primary action.
   - Close button.
3. Body:
   - Left section navigation: General, Graph, Run Policy, Browser Launch,
     Environment.
   - Main section content in grouped field panels.
   - Right/help region or inline help drawer for section guidance.
4. Section navigation:
   - Active section uses cyan.
   - Dirty section indicator uses a small dot/label.
   - Validation warning count uses amber.
5. General:
   - Workflow name field.
6. Graph:
   - Default link wait grouped control: no wait, fixed duration, random min/max.
   - Explain this affects new links only.
7. Run Policy:
   - Maximum duration.
   - Browser retention.
   - Allow Run JavaScript.
   - Run from selected grouped toggle and scope select.
   - Batch defaults visible but disabled with pause note.
8. Browser Launch:
   - Browser identity summary: identity id, display name, fingerprint seed,
     persona metadata.
   - Reuse login session switch.
   - Proxy settings group.
   - Timezone/locale/GeoIP group.
   - WebRTC and fonts group.
   - Humanize input group.
   - Headless/headed policy group.
   - Reset Identity destructive action with explanation and confirmation.
9. Environment:
   - Initial variables as typed rows with add/remove controls.
   - JSON/row mode where currently supported.

Help:
- English/Vietnamese compact segmented language toggle.
- Nested collapsible help sections.
- Field details are close to the corresponding fields or in a stable help
  panel.

Footer:
- Save Settings primary.
- Cancel/Close secondary.
- Unsaved close dialog offers Save and close, Discard changes, Keep editing.

Compact 1024x768:
- Section nav becomes horizontal tabs.
- Help collapses into a button/drawer.
- Footer stays visible.
- Body scrolls internally.
```

Acceptance checks:

- Settings feel grouped by operator decision, not as one long form.
- Risky browser identity controls are clearly separated from everyday fields.
- Save/dirty/validation states are always visible.

## Screen Prompt 6: Recording Review And Help Popups

```text
Redesign all graph-adjacent popups: Recording Review, Add Step palette,
Action Help, Step Help, Shortcuts, and small confirmation dialogs.

Use the same modal anatomy across all popups.

Recording Review:
1. Large modal with header showing session mode: Save Workflow or Replace
   Graph.
2. Show session summary: workflow name, draft mode, step count, warning count,
   captured time range.
3. Review step list:
   - Each step row has include checkbox, step number, action label, target
     summary, captured value summary, warning pill, and edit affordance.
   - Excluded steps are muted but still readable.
   - Secret/redacted values show amber warning and safe redacted text.
4. Footer actions:
   - Save Workflow / Replace Graph primary.
   - Stop/Generate Draft where relevant.
   - Discard secondary/destructive depending on state.
5. Use Mission Control tokens; remove old pure black/green styling.

Add Action/Add Logic palette:
1. Left category list, right searchable result grid/list.
2. Categories are compact and scrollable.
3. Results show label, short operator intent, and action family.
4. Hover/selected state uses cyan border and surface wash.
5. Empty search state is explicit.

Action Help / Step Help:
1. Header with action/node name, type, language toggle, close.
2. Scrollable content with collapsible sections.
3. Required fields, optional fields, advanced fields, outputs, examples, safety
   notes, and common mistakes appear as structured disclosure groups.
4. Long examples and technical details use monospace blocks in contained
   regions.

Shortcuts:
1. Compact groups for navigation, selection, editing, run/save.
2. Use kbd tokens, two-column layout on desktop, one column at compact width.
```

Acceptance checks:

- All popups share the same border, radius, header, body, footer, and close
  language.
- Recording Review no longer visually diverges from Mission Control.
- Palette content is usable with many action types.

## Screen Prompt 7: Runs

```text
Redesign the Runs workspace for active and recent run monitoring.

Use current behavior: list run snapshots, show selected persisted run detail
when provided, show missing run target, stop active run, open related Evidence,
Workflow, and Identity when links exist.

Layout:
1. Header:
   - Eyebrow: Execution.
   - Title: Runs.
   - Summary chips: active count, session run count.
2. Main panel:
   - Master-detail layout when a focused run detail exists.
   - Table/list of runs with columns: workflow, source, status, step, started,
     issue, actions.
   - Active rows have cyan running status and destructive Stop action.
3. Focused run detail:
   - Header with workflow name and status pill.
   - Run ID, started time, source, identity, issue summary.
   - Traceability actions: Open Evidence, Open Workflow, Open Identity.
   - Step timeline/list with step number, action type, status, error summary,
     artifact marker.
4. Missing run target:
   - Amber/red stale state with safe run id and return-to-list guidance.

States:
- Empty: "No runs in this session".
- Error: red alert above panel.
- Long issue text is truncated in table and expanded in detail.

Compact 1024x768:
- Table wrapper scrolls horizontally.
- Detail stacks above table if focused.
- Hide issue text before hiding status/action.
```

Acceptance checks:

- Active run stop action is scoped to the selected row/run id.
- Run detail is clearly connected to workflow/evidence/identity.
- Missing target state is explicit.

## Screen Prompt 8: Evidence Explorer

```text
Redesign Evidence Explorer as a durable investigation workspace for typed run
evidence.

Use current behavior: list evidence, search/filter by type, select evidence,
preview screenshots through safe preview data, reveal artifacts, export
selection, navigate to related workflow/run/identity.

Layout:
1. Header:
   - Eyebrow: Evidence Workspace.
   - Title: Evidence Explorer.
   - Last refreshed timestamp.
   - Actions: Refresh, Export Selection.
2. Filter toolbar:
   - Search input.
   - Type select.
   - View segmented control: List/Grid.
   - Selection count chip when items selected.
3. Workspace:
   - Left/main results panel.
   - Right detail panel.
4. Results:
   - List mode: dense rows with checkbox, evidence label, type/status/source,
     workflow, identity, timestamp, selected state.
   - Grid mode: compact cards for screenshots/artifacts, but keep data dense
     and readable.
5. Detail panel:
   - Evidence title/type/status.
   - Screenshot preview area when available.
   - Metadata definition list: workflow, run, identity, step, artifact kind,
     created time, safe relative label.
   - Actions: Preview Screenshot, Reveal Artifact, Open Run, Open Workflow,
     Open Identity.
6. Warnings:
   - Malformed/skipped data warning uses amber contained message.
   - Detail load error uses amber/red contained state depending severity.
7. Export result:
   - Show success status with bundle destination label, but do not expose unsafe
     absolute paths if the product boundary forbids it.

Compact 1024x768:
- Detail panel becomes stacked below results or a drawer.
- Toolbar wraps into two rows.
- Grid becomes one/two columns.
```

Acceptance checks:

- Evidence list and detail feel investigative and traceable.
- Screenshot preview is visually bounded and does not distort layout.
- Bulk selection/export state is clear.

## Screen Prompt 9: Identity Lab

```text
Redesign Identity Lab as a browser identity posture and session continuity
workspace.

Use current behavior: list managed identities, show current/historical detail,
refresh, open evidence/run/workflow/settings, close retained session, reset
identity through confirmation, show sanitized diagnostics and rotation history.

Layout:
1. Header:
   - Eyebrow: Identity Workspace.
   - Title: Identity Lab.
   - Last refreshed timestamp.
   - Refresh action.
2. KPI row:
   - Managed.
   - Retained Sessions.
   - Recent Failures.
3. Workspace:
   - Left identity list.
   - Right detail panel.
4. Identity list rows:
   - Display name or identity id.
   - Workflow name.
   - Session status.
   - Recent failure indicator.
   - Selected state.
5. Managed detail:
   - Header with identity display name, workflow, status/session pill.
   - Action row: Open Evidence, Open Last Run, Open Workflow Settings, Close
     Retained Session when allowed, Reset Identity.
   - Warnings for blocked reset/session issues.
   - Sections: Configured Posture, Latest Observed, Diagnostics, Evidence,
     Rotation History.
   - Definition lists use two-column dense rows and monospace for technical
     ids/values.
6. Historical detail:
   - Read-only banner.
   - Observed fields.
   - Open Related Run/Workflow actions when available.
7. Reset Identity confirmation:
   - Destructive dialog that explains scope and blocked states.

Compact 1024x768:
- KPI row becomes one or two columns.
- List/detail stack.
- Definition rows become one column.
```

Acceptance checks:

- Identity id, fingerprint seed, diagnostics, and session concepts are
  readable without exposing unsafe raw paths or secrets.
- Destructive identity reset is visually separated and confirmed.
- Historical identity state cannot be mistaken for an editable current identity.

## Screen Prompt 10: Schedules

```text
Redesign Schedules as a cross-workflow automation schedule management
workspace.

Use current behavior: list schedules, create/edit, enable/disable, delete,
view history, open run/workflow links from history when available.

Layout:
1. Header:
   - Eyebrow: Automation.
   - Title: Schedules.
   - Summary chip: schedule count.
   - Primary action: New Schedule.
2. Schedule panel:
   - Dense table with columns: status, schedule, workflow, next run, last
     result, actions.
   - Enabled status uses cyan/green depending semantic; disabled uses muted.
   - Focused schedule target row has cyan selection treatment.
   - Last result shows status plus short reason.
3. Actions:
   - Enable/Disable text button.
   - Edit icon.
   - History icon.
   - Delete destructive icon.
4. Create/Edit dialog:
   - Fields: workflow, name, enabled switch, schedule kind.
   - Kind-specific controls:
     once_at, interval with unit, daily time, weekly weekdays, monthly day.
   - Validation messages inline.
   - Footer: Save/Create primary, Cancel secondary.
5. History dialog/panel:
   - Schedule name and workflow.
   - Event list with created time, type/status, reason, run id when present.
   - Actions to open run/workflow when available.
6. Empty state:
   - "No schedules yet" with New Schedule action.

Compact 1024x768:
- Table scrolls inside wrapper.
- Create/Edit dialog fits viewport with internal scroll.
- Weekday selector remains tappable/clickable and does not overflow.
```

Acceptance checks:

- Schedule kind forms are grouped and easy to scan.
- Enabled/disabled and last-result states are not confused.
- History is readable and traceable.

## Screen Prompt 11: App Settings

```text
Redesign App Settings as an app-level diagnostics and maintenance workspace.

Use current behavior only: graph autosave preference, environment readiness
diagnostics, refresh diagnostics, install CloakBrowser binary, cleanup orphaned
profiles, maintenance message, graph shortcuts guide.

Layout:
1. Header:
   - Eyebrow: Application.
   - Title: Settings.
2. Use a single-column or two-column operations settings layout, not a
   marketing settings page.
3. Graph Persistence panel:
   - Autosave graph changes switch.
   - Short description.
4. Environment Readiness panel:
   - Header with Refresh Diagnostics action.
   - Readiness grid: CloakBrowser, GeoIP, Headed display, Fingerprint fonts,
     Profiles, Smoke check.
   - Each readiness item has label, value, and semantic tone.
   - Diagnostics error/loading states are contained.
5. Maintenance panel:
   - Install CloakBrowser Binary.
   - Cleanup Orphaned Profiles.
   - Explain these operate on local lab runtime and inactive profiles only.
   - Maintenance message status area.
6. Graph Shortcuts panel:
   - Shortcut groups for navigation, selection, editing, run/save.
   - Use kbd tokens and compact descriptions.

Compact 1024x768:
- Readiness grid becomes one column or two columns depending width.
- Maintenance actions wrap.
- Shortcut guide becomes one column.
```

Acceptance checks:

- Settings does not introduce theme, notification, global policy, or retention
  systems that do not exist.
- Diagnostics are useful but do not expose raw local paths.
- Maintenance commands look guarded and local.

## Screen Prompt 12: CSS And Responsive Polish Pass

```text
Perform a final CSS/UI consistency pass across the Mission Control app after
the screen redesigns.

Scope:
1. Replace one-off legacy colors with design tokens.
2. Remove old neutral black/green recording-review styling and align it with
   Mission Control tokens.
3. Standardize border radius: controls/panels/cards max 8px, dialogs max 12px.
4. Standardize page header anatomy across all workspaces.
5. Standardize button hierarchy and icon-only tooltip treatment.
6. Standardize dialog anatomy and viewport clamping.
7. Standardize status pills and semantic tones.
8. Standardize field labels/help/error messages.
9. Standardize empty/loading/error/stale states.
10. Verify 1024x768 compact desktop:
    - Sidebar collapses or stacks without horizontal overflow.
    - Command bar remains usable.
    - Tables scroll internally.
    - Dialogs fit viewport.
    - Graph canvas remains usable.
    - Inspector/palettes do not crush fields.
11. Ensure text never overlaps controls or adjacent content.
12. Ensure long workflow names, run ids, identity ids, paths, and error text
    truncate or wrap intentionally.

Do not add decorative orbs, marketing hero sections, new product areas, theme
switchers, notification systems, global policy editors, or unsupported future
features.
```

Acceptance checks:

- No screen reads as a separate visual system.
- No page-level horizontal overflow at 1024x768.
- Dialogs and popovers stay inside viewport.
- Long technical text is contained.
- State color semantics remain consistent.

## Stitch Iteration Rules

After each screen generation:

1. Compare it against this spec and `DESIGN.md`.
2. Reject outputs that look like a landing page, marketing dashboard, or
   generic SaaS template.
3. Reject outputs that use green as primary brand/action color.
4. Reject outputs with oversized cards, decorative gradients, nested cards, or
   hero-scale typography.
5. Ask Stitch for a targeted edit instead of regenerating everything when only
   one area is wrong.
6. Keep prompts narrow: one screen or component group per pass.
7. Keep the current product behavior visible; do not accept controls for
   future features without real backing behavior.

## Implementation Boundary For Later Work

If this Stitch spec is later converted into production code:

- Read `docs/README.md`, `docs/task-routes.md`, `docs/agent-workflow.md`,
  `DESIGN.md`, `docs/architecture/frontend.md`, and
  `docs/domain/user-visible-invariants.md`.
- Use `.agents/skills/test-driven-development` before code changes.
- Update focused UI tests and `src/AppCss.test.ts` when CSS invariants change.
- Run at least focused UI tests, `npm test -- src/AppCss.test.ts`, and
  `npx tsc --noEmit` for production UI changes.
- Use Playwright or equivalent screenshot checks for desktop and compact
  desktop when making layout changes.
- Update docs only when behavior, ownership, routes, or current source of truth
  changes.

## Spec Self-Review

- No unresolved placeholders remain.
- The scope is design-only and screen-by-screen.
- The spec preserves the current Mission Control product boundary.
- The prompts are detailed enough to run independently in Stitch.
- The shared component rules cover popup, button, form, table, state, and
  responsive polish requirements.
