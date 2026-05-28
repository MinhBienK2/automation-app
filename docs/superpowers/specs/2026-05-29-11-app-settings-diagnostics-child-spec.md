# Mission Control UI/UX Upgrade Child Spec 11: App Settings, Diagnostics, And Maintenance

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`
- `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`
- `docs/superpowers/specs/2026-05-29-05-graph-builder-child-spec.md`
- `docs/superpowers/specs/2026-05-29-06-workflow-settings-child-spec.md`
- `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`
- `docs/superpowers/specs/2026-05-29-08-evidence-explorer-child-spec.md`
- `docs/superpowers/specs/2026-05-29-09-identity-lab-child-spec.md`
- `docs/superpowers/specs/2026-05-29-10-schedules-child-spec.md`

It owns the app-level Settings workspace: graph autosave preference,
environment readiness diagnostics, local maintenance commands, maintenance
messages, and graph shortcut guidance. It does not own per-workflow Workflow
Settings, identity editing, evidence investigation, run policy, browser launch
configuration, schedule policy, or product-wide governance features.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the settings-specific decisions so
implementation agents do not expand App Settings into unrelated product
systems.

App Settings is a high-trust utility workspace. It exposes local runtime health
and maintenance actions that can affect CloakBrowser binaries and browser
profiles. The UI must be useful for operators and safe for screenshots,
reviews, demos, and audit discussions.

## Brainstorming Decisions

### Decision 1: Product Boundary

Question: should Settings become the place for all product policies or stay
strictly app-level?

Options considered:

- All product policies.
  - Pros: one settings destination.
  - Cons: duplicates Workflow Settings, adds unsupported global policy and
    retention systems, and makes future implementation agents guess.
- App-level only.
  - Pros: matches current code and docs; keeps workflow identity, run policy,
    and environment variables where they belong.
  - Cons: Settings looks smaller than a generic SaaS settings page.
- App-level plus read-only links to workflow policies.
  - Pros: discoverable.
  - Cons: risks confusing ownership and stale summaries.

Recommended and approved: App Settings remains app-level only.

### Decision 2: Navigation Model

Question: should Settings be a long page, tabs, or a two-column settings
workspace?

Options considered:

- One long page.
  - Pros: current shape and simplest.
  - Cons: harder to scan once diagnostics detail and maintenance confirmations
    are added.
- Tabs.
  - Pros: familiar for settings.
  - Cons: small number of sections does not need tab state.
- Two-column operations settings layout.
  - Pros: compact, scannable, supports local section navigation at `1024x768`,
    and still degrades to stacked panels.
  - Cons: needs careful responsive CSS.

Recommended and approved: use a two-column or stacked operations settings
layout with clear sections, not a marketing settings page.

### Decision 3: Preference Save Model

Question: should graph autosave changes require `Save Changes` or apply
immediately?

Options considered:

- Page-level `Save Changes`.
  - Pros: common for many preferences.
  - Cons: current graph autosave is a single local app preference and already
    applies immediately.
- Immediate toggle.
  - Pros: matches current behavior; operators see graph save status change
    right away.
  - Cons: no bulk apply model if many settings are added later.
- Hybrid with undo toast.
  - Pros: safer for many preferences.
  - Cons: unnecessary until there are more app-level preferences.

Recommended and approved: graph autosave remains an immediate app-level
preference. Do not add a fake page-level save action for this pass.

### Decision 4: Diagnostics Depth

Question: should diagnostics render raw CloakBrowser paths and raw profile/font
paths?

Options considered:

- Full raw diagnostics.
  - Pros: maximum debugging.
  - Cons: violates existing safe display boundary and leaks local machine
    details.
- Summary only.
  - Pros: safe and clear.
  - Cons: may hide useful operator triage details.
- Sanitized summary plus bounded detail.
  - Pros: shows readiness, versions, counts, warnings, hashes, and profile
    posture without raw absolute paths.
  - Cons: requires formatter helpers.

Recommended and approved: sanitized summary plus bounded detail.

### Decision 5: Maintenance Guarding

Question: should maintenance actions run immediately or require confirmation?

Options considered:

- Immediate run.
  - Pros: fast.
  - Cons: weak for local file deletion and binary download/install.
- Confirmation for cleanup only.
  - Pros: guards destructive action.
  - Cons: install still changes local runtime state.
- Confirmation or clear scoped preflight for both actions.
  - Pros: names impact, avoids accidental local changes, and keeps audit trust.
  - Cons: one extra click.

Recommended and approved: use guarded maintenance actions. Cleanup requires a
confirmation. Install uses either a confirmation dialog or a scoped preflight
panel before the command runs.

### Decision 6: Shortcut Guide Ownership

Question: should App Settings define its own shortcut list or reuse the Graph
Builder shortcut guide?

Options considered:

- Duplicate local shortcut data.
  - Pros: independent Settings page.
  - Cons: drift from Graph Builder.
- Reuse `GraphShortcutGuide`.
  - Pros: one source of truth for graph shortcuts.
  - Cons: Settings is coupled to workflow component module until extracted.
- Move shortcuts to shared lib first.
  - Pros: ideal ownership.
  - Cons: extra refactor; should be done only if implementation touches both
    areas.

Recommended and approved: reuse existing guide for now; extract to shared module
only if the implementation pass already needs it.

### Decision 7: Component Split

Question: should `SettingsPage.tsx` remain one component?

Options considered:

- Keep one component.
  - Pros: currently small.
  - Cons: diagnostics formatting and maintenance confirmations will grow it.
- Split by section and formatter.
  - Pros: easier tests, safer updates, and clearer ownership.
  - Cons: more files.

Recommended and approved: split by section and keep formatting helpers isolated.

## Goal

Turn App Settings into a polished Mission Control operations workspace for
local app preferences, runtime readiness, maintenance, and graph shortcut
reference.

The implementation must:

1. Keep Settings app-level only.
2. Preserve graph autosave as an immediate app preference.
3. Show diagnostics in sanitized, useful readiness sections.
4. Present maintenance commands with clear scope, confirmation, pending, error,
   and result states.
5. Keep graph shortcuts compact and consistent with Graph Builder.
6. Avoid adding unsupported theme, notification, policy, retention, global
   allowlist, account, or operator-profile systems.
7. Preserve the existing dark Mission Control design system.
8. Work at `1024x768`.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `docs/agent-workflow.md`

Then read:

1. `docs/domain/user-visible-invariants.md`
2. `docs/architecture/frontend.md`
3. `docs/architecture/command-boundary.md`
4. `docs/contracts/electron-ipc.md`
5. `docs/contracts/workflow-types.md`
6. `README.md`, CloakBrowser Operations section

Because this is UI work, also read:

1. `DESIGN.md`
2. Child spec 01 Foundation UI System
3. Child spec 02 Shell Navigation, Search, Alerts
4. Child spec 05 Graph Builder
5. Child spec 06 Workflow Settings
6. Child spec 09 Identity Lab

### Source Files To Inspect

Primary frontend:

- `src/features/settings/pages/SettingsPage.tsx`
- `src/features/workflows/components/GraphShortcutGuide.tsx`
- `src/App.tsx`
- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/types/electron.ts`
- `src/styles/layout.css`
- `src/styles/workflow-graph.css`
- `src/styles/responsive.css`

Primary backend contracts:

- `electron/backend/commands.ts`
- `electron/ipc.ts`
- `electron/preload.cts`
- `electron/backend/browser/localEnvironment.ts`
- `electron/backend/browser/sessionManager.ts`

Primary tests:

- Existing settings tests if present.
- New `src/features/settings/pages/SettingsPage.test.tsx` if absent.
- `src/lib/workflowApi.test.ts` if API usage changes.
- `electron/backend/commands.test.ts` if command behavior changes.
- `electron/backend/browser/sessionManager.test.ts` only if profile/session
  behavior changes.

## Current Implementation Readout

The current Settings page supports:

- Header:
  - Eyebrow `Application`
  - Title `Settings`
- Graph persistence panel:
  - `Autosave graph changes` switch.
- Environment readiness panel:
  - Refresh Diagnostics button.
  - Diagnostics error alert.
  - Loading text.
  - Readiness grid:
    - CloakBrowser
    - GeoIP
    - Headed display
    - Fingerprint fonts
    - Profiles
    - Smoke check
- Maintenance panel:
  - `Install CloakBrowser Binary`
  - `Cleanup Orphaned Profiles`
  - Maintenance scope copy.
  - Maintenance message status.
- Graph shortcuts panel:
  - Reuses `GraphShortcutGuide`.

Known UI limitations to address:

- Panels are stacked with a narrow `max-width: 720px`, making the page feel
  unfinished compared with other workspaces.
- Diagnostics cards show only a top-level value and miss useful bounded detail.
- Diagnostics can be loading without preserving stale previous values clearly.
- Maintenance actions run without an explicit confirmation surface in the page
  component.
- Maintenance result is a single message string rather than structured summary.
- Install and cleanup do not have action-specific pending/error states.
- Cleanup scope should say it deletes only orphaned inactive profiles.
- Diagnostics type includes paths, but UI must not render raw binary/cache,
  profile, or font paths.
- Graph shortcuts are useful but need better section framing inside Settings.
- No Settings-specific test file is visible.

## Non-Negotiable Product Invariants

### App-Level Boundary

Settings owns:

- Graph autosave app preference.
- App-level diagnostics.
- Environment readiness.
- Guarded maintenance commands.
- Graph shortcut guidance.

Settings does not own:

- Per-workflow Browser Launch configuration.
- Per-workflow Run Policy.
- Per-workflow Environment variables.
- Workflow identity reset.
- Identity diagnostics for one selected workflow identity.
- Evidence investigation.
- Schedule policy.
- Global domain allowlist editor.
- Theme switch.
- Notification preferences.
- Evidence retention editor.
- Operator account/profile management.

If a Stitch design or earlier mockup implies unsupported features, production
implementation must omit them or replace them with truthful links to the owning
workspace.

### Diagnostics Safety

Settings diagnostics must not expose:

- Proxy credentials.
- Cookies.
- Local storage.
- Session storage.
- Browser storage contents.
- Account secrets.
- Raw run outputs.
- Absolute local binary path.
- Absolute local cache path.
- Absolute local profile root.
- Absolute local font directories.

Allowed safe diagnostics:

- CloakBrowser wrapper version.
- CloakBrowser binary installed yes/no.
- CloakBrowser binary version.
- Platform value if not sensitive.
- Auto-update enabled yes/no.
- Checksum skip enabled yes/no, shown as warning.
- GeoIP available yes/no.
- Headed display available yes/no.
- Headed display reason if safe.
- Fingerprint font status.
- Fingerprint font directory count.
- Font file counts and total sizes.
- Missing expected font family names.
- Shared-directory warning by workflow names, without raw paths.
- Normalized hash prefix, not necessarily full hash.
- Managed profile count.
- Active retained profile count.
- Orphan profile count.
- Approximate profile sizes.
- Last smoke status and reason.

### Maintenance Safety

Install CloakBrowser Binary:

- Uses existing backend command.
- May download or install local browser runtime managed by CloakBrowser.
- Must show pending, success, and failure states.
- Must refresh diagnostics after success.
- Must not ask users to edit cache paths manually.

Cleanup Orphaned Profiles:

- Uses existing backend command.
- Deletes only orphaned browser profile directories returned as safe profile
  names by backend logic.
- Skips profiles attached to workflows.
- Skips active retained sessions.
- Must show confirmation before command.
- Must show deleted count, skipped count, and reclaimed approximate size.
- Must not imply it deletes evidence, workflow settings, cookies for active
  managed profiles, or historical runs.

### Autosave Preference

- Graph autosave is app-level.
- It is enabled by default.
- It can be changed from Settings.
- When enabled, graph edits save after changes.
- When disabled, users save graph edits manually.
- The setting affects Graph Builder save status presentation.
- The Settings UI should not pretend autosave applies to Workflow Settings.

### Shortcut Guide

- Shortcut guide content must match real Graph Builder behavior.
- It must not list shortcuts that are not implemented.
- If shortcut behavior changes in Graph Builder, the guide must change in the
  shared source.

## Information Architecture

### Page Regions

Settings should use these regions:

1. Header
2. Local section navigation or summary rail
3. Graph Persistence
4. Environment Readiness
5. Maintenance
6. Graph Shortcuts

Recommended layout:

- Wide desktop:
  - two-column workspace;
  - left column contains local navigation or compact summary;
  - right/main column contains panels.
- Standard desktop:
  - stacked panels with full-width content up to comfortable max width.
- `1024x768`:
  - local navigation becomes vertical segmented list or stacked tabs;
  - panels stack;
  - diagnostics grid becomes one or two columns.

Do not create a landing page or oversized hero.

### Header

Header content:

- Eyebrow:
  - `Application`
- Title:
  - `Settings`
- Secondary line:
  - `App preferences, local runtime readiness, and maintenance.`

Header actions:

- `Refresh Diagnostics` may live in header only if also clearly tied to
  Environment Readiness.
- Otherwise keep `Refresh Diagnostics` inside the diagnostics panel.

No global `Save Changes` button is required for this pass.

### Local Section Navigation

Optional but recommended when layout becomes two-column.

Items:

- `Graph Persistence`
- `Environment Readiness`
- `Maintenance`
- `Graph Shortcuts`

Behavior:

- Scrolls to section or selects section depending on layout.
- Uses actual buttons or anchors.
- Shows selected section.
- Does not route away from Settings.

At compact width:

- Convert to vertical segmented list or stacked buttons.
- Keep labels readable.

### Graph Persistence Panel

Purpose:

- Own the graph autosave preference.

Required content:

- Eyebrow:
  - `Workflow Editing`
- Heading:
  - `Graph persistence`
- Switch:
  - `Autosave graph changes`
- Description:
  - `Save graph edits after changes. Turn this off to use manual Save.`
- Current state summary:
  - `Autosave is on`
  - `Manual save is required`

Behavior:

- Toggle calls `onGraphAutosaveEnabledChange`.
- Toggle pending state is not required for local synchronous storage, but if
  the implementation adds async persistence, show pending and failure states.
- Do not add autosave controls for Workflow Settings.

### Autosave State Copy

When enabled:

- `Graph edits save after changes.`

When disabled:

- `Graph edits remain unsaved until you choose Save in the workflow detail.`

Avoid:

- `All changes autosave`
- `Settings autosave`
- `Runs autosave`

### Environment Readiness Panel

Purpose:

- Show local runtime readiness for CloakBrowser-backed automation.

Header:

- Eyebrow:
  - `Runtime`
- Heading:
  - `Environment readiness`
- Action:
  - `Refresh Diagnostics`

Required readiness cards:

1. CloakBrowser
2. GeoIP
3. Headed display
4. Fingerprint fonts
5. Profiles
6. Smoke check

Each readiness item must have:

- Label.
- Primary value.
- Tone:
  - ready
  - attention
  - neutral
- Optional secondary detail.

### CloakBrowser Readiness

Data:

- `diagnostics.wrapper_version`
- `diagnostics.binary.installed`
- `diagnostics.binary.version`
- `diagnostics.binary.platform`
- `diagnostics.auto_update_enabled`
- `diagnostics.checksum_skip_enabled`

Primary values:

- Installed:
  - `Installed <version>`
- Not installed:
  - `Not installed`

Secondary details:

- `Wrapper <version>` if available.
- `Platform <platform>` if available.
- `Auto-update off` when `auto_update_enabled` is false.
- `Checksum skip enabled` as warning when true.

Do not show:

- `binary_path`
- `cache_dir`
- `download_url`

Download URL may be mentioned only as `Configured download source` if needed;
do not render full URL by default.

### GeoIP Readiness

Data:

- `diagnostics.geoip_available`

Primary values:

- `GeoIP available`
- `GeoIP unavailable`

Secondary detail:

- If unavailable:
  - `GeoIP-based timezone and locale may need explicit Workflow Settings.`

Do not imply Settings edits workflow timezone/locale.

### Headed Display Readiness

Data:

- `diagnostics.headed_display.available`
- `diagnostics.headed_display.reason`

Primary values:

- `Available`
- `Unavailable`

Secondary detail:

- Safe reason may be shown:
  - `No DISPLAY or WAYLAND_DISPLAY is configured for headed Linux runs`

Tone:

- Ready when available.
- Attention when unavailable.

### Fingerprint Fonts Readiness

Data:

- `diagnostics.font_checklist.status`
- `diagnostics.font_checklist.reason`
- `diagnostics.font_checklist.directories`

Primary values:

- `Not configured`
- `Ok`
- `Warning`
- `Error`

Secondary details:

- Directory count:
  - `3 configured directories`
- File count total:
  - `24 font files`
- Missing expected family names:
  - `Missing: arial, courier`
- Shared directory warning:
  - `Shared by multiple workflow identities`
- Normalized hash:
  - show first 12 characters only if useful;
  - label as `font set hash`.

Do not show:

- raw directory path;
- full absolute paths from `directories[].path`.

If the backend currently returns raw paths in `reason`, formatter must sanitize
or avoid rendering that reason.

### Profiles Readiness

Data:

- `diagnostics.profiles`

Derived values:

- Managed profile count.
- Active retained profile count.
- Orphan profile count.
- Approximate total profile size.
- Skipped cleanup count after cleanup command if available.

Primary value:

- `<n> managed profiles`

Secondary details:

- `<n> retained sessions active`
- `<n> orphaned profiles can be cleaned`
- `<size> approximate local storage`

Do not show:

- raw profile root.
- absolute path.
- browser storage contents.

Profile names may be shown only if they are safe backend profile identifiers and
not absolute paths. Prefer counts over lists in App Settings.

### Smoke Check Readiness

Data:

- `diagnostics.last_smoke_result.status`
- `diagnostics.last_smoke_result.reason`

Current status:

- `not_recorded`

Primary value:

- `Not recorded`

Secondary detail:

- `Smoke tests are recorded by npm run test:smoke command output`

Do not add a UI button to run the full smoke test unless backend command support
exists. Running smoke tests can be expensive and is out of scope for Settings
UI.

### Diagnostics Loading State

Initial load:

- Show header and skeleton cards or `Loading diagnostics...`.

Refresh with existing data:

- Keep existing cards visible.
- Show small `Refreshing...` state on the refresh action.
- Do not blank the grid unless no previous diagnostics exist.

### Diagnostics Error State

Error placement:

- Inside Environment Readiness panel.
- `role="alert"`.
- Keep previous diagnostics visible if available.

Copy:

- `Could not refresh diagnostics.`
- Append safe command message when available.

Retry:

- `Refresh Diagnostics` remains available.

## Maintenance Panel

### Panel Purpose

Maintenance lets operators run bounded local commands that affect the local lab
runtime. It is not a file browser, evidence cleanup tool, or policy editor.

Header:

- Eyebrow:
  - `Runtime`
- Heading:
  - `Maintenance`

Scope copy:

- `Maintenance commands operate only on the local lab runtime and orphaned
  inactive browser profiles.`

### Install CloakBrowser Binary

Button:

- `Install CloakBrowser Binary`

Confirmation or preflight:

- Title:
  - `Install CloakBrowser Binary`
- Body:
  - `This installs or repairs the local CloakBrowser-managed browser runtime
    used by workflow runs. It does not change workflow settings.`
- Primary:
  - `Install Binary`
- Secondary:
  - `Cancel`

Behavior:

1. User clicks install.
2. Confirmation/preflight appears.
3. User confirms.
4. Button enters pending state.
5. `onInstallBinary` calls backend.
6. On success:
   - show success message;
   - refresh diagnostics or use returned diagnostics if callback provides it.
7. On failure:
   - show action-specific error;
   - leave diagnostics unchanged unless refresh succeeds.

### Cleanup Orphaned Profiles

Button:

- `Cleanup Orphaned Profiles`

Confirmation:

- Title:
  - `Cleanup Orphaned Profiles`
- Body:
  - `Delete only orphaned inactive browser profiles not attached to workflows
    and not held by retained sessions. Workflows, evidence, settings, and
    active profiles are preserved.`
- Primary destructive:
  - `Cleanup Profiles`
- Secondary:
  - `Cancel`

Pre-confirmation summary, if diagnostics available:

- Orphan profile count.
- Approximate reclaimable size.
- Skipped active/managed profile count.

Behavior:

1. User clicks cleanup.
2. Confirmation appears.
3. User confirms.
4. Cleanup button enters pending state.
5. `onCleanupProfiles` calls backend.
6. On success:
   - show deleted count;
   - show skipped count;
   - show reclaimed approximate size;
   - refresh diagnostics.
7. On failure:
   - show action-specific error;
   - do not imply cleanup happened.

### Maintenance Messages

Current prop:

- `maintenanceMessage: string`

Required UI behavior:

- Render success messages with `role="status"`.
- Render errors with `role="alert"` if implementation separates error state.
- Keep message inside Maintenance panel.
- Do not show messages as global app errors unless command fails outside
  Settings context.

Recommended future shape:

```ts
type MaintenanceStatus =
  | { kind: "idle" }
  | { kind: "pending"; action: "install" | "cleanup" }
  | { kind: "success"; action: "install" | "cleanup"; message: string }
  | { kind: "error"; action: "install" | "cleanup"; message: string };
```

This spec does not require changing props if a simpler implementation can meet
the visible behavior.

### Cleanup Result Formatting

If backend returns `BrowserProfileCleanupResult`, format:

- `Deleted 3 orphaned profiles`
- `Skipped 2 managed or active profiles`
- `Reclaimed about 128 MB`

If deleted count is zero:

- `No orphaned profiles were deleted.`

If skipped count is non-zero:

- `Managed and active profiles were preserved.`

Do not list profile names by default.

## Graph Shortcuts Panel

### Purpose

Graph Shortcuts is a reference section for operators who edit workflows often.
It must remain consistent with Graph Builder.

Header:

- Eyebrow:
  - `Workflow Editing`
- Heading:
  - `Graph shortcuts`

Content groups:

- Navigation.
- Selection.
- Editing.
- Run and save.

Data source:

- Existing `GraphShortcutGuide`.

### Shortcut Row Requirements

Each shortcut row shows:

- `kbd` key or gesture.
- Short description.

Layout:

- Two-column shortcut groups on wide desktop.
- One-column at compact width.
- `kbd` tokens have stable width where practical.
- Long shortcut strings wrap without overflow.

Accessibility:

- Each group has an accessible section label.
- `kbd` text is visible text.
- No icon-only shortcut rows.

### Shortcut Accuracy

Do not list:

- Shortcuts not implemented.
- Shortcuts that are reserved by the OS and not handled by the app.
- Hidden debug shortcuts.

If Graph Builder shortcut behavior changes, update this shared guide and
associated tests.

## Cross-Workspace Relationships

### Workflow Settings

App Settings must not duplicate Workflow Settings fields.

Do not add:

- Browser Launch identity fields.
- Proxy fields.
- Timezone/locale controls.
- Run Policy controls.
- Environment variables.
- Reset Identity.
- Reuse login session.
- Batch run defaults.

If users need those:

- route to Workflow Settings from workflow context;
- do not add generic links from App Settings without a selected workflow.

### Identity Lab

Identity Lab owns:

- managed identity posture;
- selected identity diagnostics;
- retained session close action;
- identity reset action;
- latest identity evidence;
- historical identity references.

App Settings owns:

- app-level runtime readiness;
- aggregate profile counts;
- local maintenance.

Do not show identity detail cards in App Settings.

### Evidence Explorer

Evidence Explorer owns artifacts and evidence detail.

App Settings does not:

- browse evidence;
- delete evidence;
- export evidence;
- reveal evidence artifact paths.

### Graph Builder

Graph Builder owns:

- save status;
- validation;
- canvas shortcuts in context;
- graph editing controls.

App Settings owns:

- autosave preference;
- shortcut reference.

Changing autosave from Settings must immediately affect Graph Builder save
status and manual save behavior.

## Visual Design Requirements

Follow `DESIGN.md`.

Required tokens:

- Canvas: `#0B1016`
- Sidebar/inset: `#0E151D`
- Surface: `#121C26`
- Elevated surface: `#172431`
- Border: `#233240`
- Emphasized border: `#314758`
- Primary text: `#E7EEF5`
- Secondary text: `#9AAEBD`
- Muted text: `#667D8D`
- Cyan for active/focus.
- Green for ready.
- Amber for attention/warning.
- Red for failure/destructive cleanup confirmation.

Density:

- Panels use compact headers.
- Readiness cards use small metadata.
- No card nesting for decorative purposes.
- Use table/detail or settings-panel layout rather than hero composition.

Radius:

- Panels and cards no larger than `8px`.
- Dialogs no larger than `12px`.

Typography:

- Page title: `28-32px`.
- Section headings: `18-20px`.
- Body/control text: `13-14px`.
- Metadata: `11-12px`.
- Letter spacing: `0`.

Do not introduce:

- marketing hero;
- gradient background;
- decorative orbs;
- one-note purple/blue theme;
- large empty spacing;
- visible raw JSON blocks.

## Accessibility Requirements

### Keyboard

Required:

- Sidebar opens Settings.
- Local section navigation is keyboard reachable.
- Autosave switch is keyboard operable.
- Refresh Diagnostics is keyboard reachable.
- Install and Cleanup buttons are keyboard reachable.
- Confirmation dialogs trap focus.
- Confirmation dialogs return focus to triggering button.
- Shortcut guide is readable in tab order without requiring pointer hover.

### Screen Reader

Required:

- Page section has `aria-label="Settings"`.
- Panels have meaningful labels:
  - `Workflow editing settings`
  - `Environment readiness`
  - `Maintenance`
  - `Graph shortcuts`
- Diagnostics errors use `role="alert"`.
- Maintenance success uses `role="status"`.
- Confirmation dialog names the action.
- Readiness cards expose label and value in text.

### State Communication

Do not rely on color alone.

Each readiness card must include text:

- `Installed`
- `Not installed`
- `Available`
- `Unavailable`
- `Warning`
- `Error`
- `Not recorded`

### Motion

Use minimal motion:

- Button hover/focus transitions.
- Pending spinners or inline loading labels.
- No animated status dashboards.

## Responsive Requirements

### Wide Desktop

At wide desktop:

- Use two-column settings layout if implemented.
- Readiness grid can use three columns if labels do not wrap badly.
- Shortcut guide can use two columns.
- Maintenance actions remain on one row if space allows.

### Standard Desktop

At common desktop widths:

- Panels stack or use two-column layout.
- Readiness grid uses two columns.
- Header action does not overlap title.

### 1024x768

At `1024x768`:

- Sidebar may collapse according to shell behavior.
- Local navigation becomes stacked.
- Readiness grid becomes one or two columns depending available width.
- Maintenance actions wrap.
- Shortcut guide becomes one column.
- Confirmation dialogs fit within viewport.
- No horizontal overflow from long shortcut strings.
- Long diagnostics values wrap safely.

### Narrow Width

If viewport narrows further:

- All panels become one column.
- `kbd` token and description stack if necessary.
- Buttons remain readable.
- Maintenance confirmation body wraps without clipping.

## Component Architecture

Recommended split:

- `SettingsPage`
  - owns high-level page layout and callbacks.
- `SettingsSectionNav`
  - local section navigation if implemented.
- `GraphPersistencePanel`
  - autosave switch and state summary.
- `EnvironmentReadinessPanel`
  - diagnostics header, refresh state, cards, details.
- `ReadinessCard`
  - label/value/tone/detail rendering.
- `DiagnosticsDetails`
  - optional bounded detail groups.
- `MaintenancePanel`
  - actions, scoped copy, messages.
- `MaintenanceConfirmDialog`
  - install/cleanup confirmation.
- `GraphShortcutsPanel`
  - wrapper around `GraphShortcutGuide`.
- `settingsDiagnosticsFormatters.ts`
  - sanitized labels, counts, byte formatting, tone mapping.
- `settingsDiagnosticsFormatters.test.ts`
  - unit tests for sensitive value omission and mappings.

Do not place backend command semantics in formatter helpers. Helpers only format
already returned read models.

## Data Flow

### Load Settings

1. App opens Settings screen.
2. App passes current `graphAutosaveEnabled`.
3. App passes current `diagnostics`, loading/error states, and maintenance
   message.
4. Settings renders current values.

### Toggle Autosave

1. User toggles switch.
2. Settings calls `onGraphAutosaveEnabledChange(enabled)`.
3. App writes local preference.
4. Graph Builder save status reflects new mode when user edits a graph.

No backend command is required.

### Refresh Diagnostics

1. User clicks `Refresh Diagnostics`.
2. Button enters pending state.
3. App calls `getCloakBrowserDiagnostics`.
4. On success:
   - update diagnostics;
   - clear diagnostics error.
5. On failure:
   - preserve previous diagnostics if present;
   - show diagnostics panel error.

### Install Binary

1. User opens install confirmation/preflight.
2. User confirms.
3. Settings calls `onInstallBinary`.
4. App calls `installCloakBrowserBinary`.
5. On success:
   - diagnostics refresh or returned diagnostics update;
   - maintenance status shows success.
6. On failure:
   - maintenance status shows install-specific error.

### Cleanup Profiles

1. User opens cleanup confirmation.
2. Dialog shows available orphan/skipped counts if diagnostics exists.
3. User confirms.
4. Settings calls `onCleanupProfiles`.
5. App calls `cleanupOrphanedBrowserProfiles`.
6. On success:
   - show cleanup result summary;
   - diagnostics refresh.
7. On failure:
   - show cleanup-specific error.

## State Matrix

### Page States

| State | Condition | UI |
| --- | --- | --- |
| Ready | diagnostics loaded or not required | Panels render |
| Diagnostics loading initial | loading true and no diagnostics | Readiness skeleton/loading |
| Diagnostics refreshing | loading true and diagnostics exists | Existing cards plus refreshing action |
| Diagnostics error | diagnosticsError non-empty | Readiness alert |
| Maintenance idle | no pending action | Actions enabled |
| Maintenance pending install | install in flight | Install disabled/pending |
| Maintenance pending cleanup | cleanup in flight | Cleanup disabled/pending |
| Maintenance success | command resolved | Status message |
| Maintenance error | command rejected | Action-specific alert |

### Readiness Tone Matrix

| Field | Ready | Attention | Neutral |
| --- | --- | --- | --- |
| CloakBrowser | installed | not installed | unknown |
| GeoIP | available | unavailable | unknown |
| Headed display | available | unavailable | unknown |
| Fingerprint fonts | ok | warning/error | not_configured |
| Profiles | none active issues | cleanup available warning if chosen | count-only |
| Smoke check | recorded success if future support exists | recorded fail if future support exists | not_recorded |

### Maintenance Confirmation States

| State | UI |
| --- | --- |
| Closed | No dialog |
| Install confirm | Install title, scope, confirm/cancel |
| Cleanup confirm | Cleanup title, scope, counts, destructive confirm/cancel |
| Pending | Confirm button stable loading |
| Error | Dialog remains open with error |
| Success | Dialog closes, Maintenance panel shows result |

## Error Handling

### Diagnostics Errors

Show inside Environment Readiness.

Rules:

- Keep previous diagnostics visible if available.
- Do not clear all readiness cards on refresh error.
- Message must be readable and safe.
- Retry remains available.

### Install Errors

Show inside Maintenance panel or install confirmation.

Examples:

- `Could not install CloakBrowser Binary.`
- Append safe backend message.

Do not ask user to set raw cache paths from the UI.

### Cleanup Errors

Show inside Maintenance panel or cleanup confirmation.

Examples:

- `Could not cleanup orphaned profiles.`
- Append safe backend message.

Do not optimistically remove profile counts after failure.

### Formatter Errors

If diagnostics data is malformed:

- Render `Unavailable`.
- Do not throw during render.
- Optionally show a non-blocking readiness warning.

## Security And Privacy Requirements

The Settings page is likely to be screenshotted during debugging. Treat it as a
safe operational summary surface.

Do not render:

- `diagnostics.binary.binary_path`
- `diagnostics.binary.cache_dir`
- `diagnostics.binary.download_url`
- `diagnostics.profile_root`
- raw `font_checklist.directories[].path`
- raw profile absolute paths
- proxy passwords
- cookies
- local storage values
- session storage values
- browser database content
- raw environment dumps

Allowed with care:

- version strings;
- platform;
- counts;
- approximate sizes;
- safe profile identifiers if not absolute paths;
- workflow names associated with font warnings;
- hash prefixes;
- safe error messages.

If a backend message includes a path:

- prefer omitting it;
- or replace with `local runtime path`;
- do not display full absolute value.

## Copy Requirements

Approved copy:

- `App preferences, local runtime readiness, and maintenance.`
- `Save graph edits after changes. Turn this off to use manual Save.`
- `Graph edits remain unsaved until you choose Save in the workflow detail.`
- `Maintenance commands operate only on the local lab runtime and orphaned inactive browser profiles.`
- `This installs or repairs the local CloakBrowser-managed browser runtime used by workflow runs.`
- `Delete only orphaned inactive browser profiles not attached to workflows and not held by retained sessions.`
- `Workflows, evidence, settings, and active profiles are preserved.`
- `Managed and active profiles were preserved.`

Avoid:

- `Delete all profiles`
- `Clean cache`
- `Reset browser`
- `Global run policy`
- `Theme`
- `Notification settings`
- `Retention policy`
- `Always run diagnostics`

## Testing Requirements

### Frontend Tests

Add `src/features/settings/pages/SettingsPage.test.tsx` if it does not exist.

Required coverage:

1. Renders Settings header and four sections.
2. Toggles graph autosave and calls callback with new value.
3. Shows enabled autosave copy.
4. Shows manual save copy when autosave disabled.
5. Renders readiness cards from diagnostics.
6. Maps CloakBrowser installed/not installed tones.
7. Maps GeoIP available/unavailable tones.
8. Maps headed display available/unavailable tones.
9. Maps fingerprint font statuses.
10. Renders profile count and active retained profile count.
11. Renders smoke check `Not recorded`.
12. Does not render raw binary path, cache dir, profile root, or font path.
13. Shows loading state with no diagnostics.
14. Preserves diagnostics while refresh loading if prop combination supports it.
15. Shows diagnostics error with `role="alert"`.
16. Opens install confirmation/preflight before callback runs.
17. Calls install callback only after confirm.
18. Opens cleanup confirmation before callback runs.
19. Cleanup confirmation names preserved workflows/evidence/settings/active
    profiles.
20. Calls cleanup callback only after confirm.
21. Shows maintenance success as `role="status"`.
22. Shows maintenance error as `role="alert"` if error state is introduced.
23. Renders GraphShortcutGuide groups.
24. Shortcut long labels do not require inaccessible icon-only interpretation.

### Formatter Tests

If formatter helpers are extracted, add tests for:

- byte formatting;
- status label formatting;
- readiness tone mapping;
- hash prefix formatting;
- path redaction;
- missing/malformed diagnostics values;
- cleanup summary formatting.

### Backend Tests

Only needed if backend command behavior changes.

Possible tests in `electron/backend/commands.test.ts`:

- diagnostics result contains expected safe fields;
- cleanup skips active retained sessions;
- cleanup skips workflow-owned profiles;
- cleanup deletes orphaned profile directories;
- install command returns refreshed diagnostics.

### API Wrapper Tests

If wrapper signatures change:

- update `src/lib/workflowApi.test.ts`;
- update `src/types/electron.ts`;
- update `electron/preload.cts`.

### Type And Build Checks

Expected checks for implementation:

- `npm test -- src/features/settings/pages/SettingsPage.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if API wrapper changes
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npx tsc --noEmit`
- `npm run build:electron` if Electron files change

## Manual QA Checklist

Run the app and verify:

1. Sidebar opens Settings in the documented order.
2. Header reads as app-level Settings.
3. No workflow-specific Browser Launch fields appear.
4. No Run Policy fields appear.
5. No theme, notification, retention, or global policy controls appear.
6. Graph autosave toggle changes app preference.
7. Turning autosave off makes Graph Builder show manual save behavior on edit.
8. Turning autosave on restores autosave behavior.
9. Refresh Diagnostics shows pending state.
10. Diagnostics success shows CloakBrowser status.
11. Diagnostics success shows GeoIP status.
12. Diagnostics success shows headed display status.
13. Diagnostics success shows fingerprint fonts status.
14. Diagnostics success shows profile count.
15. Diagnostics success shows smoke check status.
16. Diagnostics error stays inside Environment Readiness panel.
17. Raw binary/cache/profile/font paths are not visible.
18. Install button opens confirmation or preflight.
19. Install command success shows maintenance success and refreshed readiness.
20. Install command failure shows action-specific error.
21. Cleanup button opens destructive confirmation.
22. Cleanup confirmation says workflows, evidence, settings, and active profiles
    are preserved.
23. Cleanup success shows deleted/skipped/reclaimed summary when data is
    available.
24. Cleanup failure does not optimistically change profile counts.
25. Graph shortcuts show Navigation, Selection, Editing, Run and save.
26. At `1024x768`, panels stack cleanly and shortcut rows do not overflow.
27. Keyboard can operate switches, actions, and dialogs.

## Documentation Requirements

If implementation changes visible behavior, update:

- `docs/domain/user-visible-invariants.md`
- `docs/architecture/frontend.md`
- `docs/architecture/command-boundary.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/workflow-types.md`
- `docs/task-routes.md`
- `README.md` smoke checklist

If implementation is UI-only and preserves current behavior, docs updates may
be limited to README smoke checklist only if the manual QA flow changes.

## Implementation Sequence Recommendation

Implement in this order:

1. Add Settings tests for current sections and callbacks.
2. Extract diagnostics formatter helpers.
3. Add formatter tests for path redaction and tone mapping.
4. Split Settings sections into focused components.
5. Add improved readiness cards and bounded detail.
6. Add install confirmation/preflight.
7. Add cleanup confirmation.
8. Add action-specific pending/error/success states.
9. Harden responsive CSS.
10. Confirm GraphShortcutGuide remains shared and accurate.
11. Run focused tests.
12. Run typecheck.
13. Update docs only if behavior or smoke checklist changed.

Do not start by adding unsupported settings categories. The first slice should
make current capability clear, safe, and polished.

## Acceptance Criteria

The spec is satisfied when:

1. Settings reads as a finished Mission Control operations workspace.
2. App Settings remains clearly separate from Workflow Settings.
3. Graph autosave is a visible app-level preference and still applies
   immediately.
4. Diagnostics cards show useful readiness summaries.
5. Diagnostics do not display raw binary, cache, profile, or font paths.
6. Diagnostics errors and loading states are contained.
7. Install CloakBrowser Binary is guarded and has pending/success/error states.
8. Cleanup Orphaned Profiles is confirmed, scoped, and has result/error states.
9. Cleanup copy makes clear active/managed profiles, workflows, evidence, and
   settings are preserved.
10. Graph shortcuts are compact, accurate, and responsive.
11. Layout works at `1024x768`.
12. Tests cover Settings behavior and safe diagnostics formatting.
13. No unsupported theme, notification, retention, policy, or account systems
   are added.

## Agent Handoff Notes

Implementation agents should treat this as a UI/UX hardening pass over existing
Settings behavior.

Important boundaries:

- Do not add global policy.
- Do not add theme settings.
- Do not add notification settings.
- Do not add evidence retention settings.
- Do not add workflow Browser Launch fields.
- Do not add run policy fields.
- Do not expose raw paths.
- Do not show raw diagnostics JSON.
- Do not run smoke tests from the UI without a backend command.
- Do not make cleanup delete managed or active profiles.

The best first implementation slice is:

1. Add tests.
2. Extract safe diagnostics formatting.
3. Add maintenance confirmations.
4. Improve layout and responsive CSS.
5. Then refine visual polish.

This keeps the pass bounded and safe while making Settings feel complete.
