# Mission Control Identity Lab Design

Date: 2026-05-27

## Status

Approved design for a written specification on 2026-05-27.

This is specification 4 of the Mission Control production adoption program. It
is ready for user review before the final program specification is written. Per
the approved program gate, no implementation planning or production code
changes begin until all program specifications are written and approved.

## Goal

Add `Identities` as the durable Mission Control workspace for inspecting the
browser identities currently managed by workflows, their session continuity,
configured posture, latest observed identity evidence, run history, sanitized
diagnostics and rotation history.

The completed feature must:

- Provide a real Identity Lab workspace in the Mission Control shell.
- Treat current browser identity state as workflow-owned settings, not as a new
  standalone catalog.
- Make session continuity, retained-session state and reset blockers explicit
  before operators take identity actions.
- Show truthful configured and observed posture without inventing IP,
  reputation, fingerprint verdict or proxy quality data the backend does not
  observe.
- Preserve historical identity traceability after identity reset without
  turning old identities into editable managed rows.
- Keep diagnostics and session-control actions inside sanitized, typed
  Electron/backend commands.
- Extend the Evidence navigation approved in specification 3 with `Open
  Identity` targets.

## Program Position

The Mission Control program is specified in this order:

| Sequence | Specification | Boundary |
| --- | --- | --- |
| 1 | Mission Control Foundation And Existing Workspace Adoption | Production design system, shell, current workspaces and Graph Builder overlays. |
| 2 | Operations Overview | Durable operations dashboard and initial run/evidence reference boundary. |
| 3 | Evidence Explorer | Standalone evidence investigation, safe artifact interactions and bundle export. |
| 4 | Identity Lab | Standalone identity/session posture and diagnostics workspace. |
| 5 | Cross-Workspace Traceability And Polish | Final deep links, navigation consistency, compact behavior and suite parity. |

This specification assumes the design system and shell from specification 1,
the durable operations/read-model boundary from specification 2 and the
Evidence Explorer/navigation boundary from specification 3. It does not
authorize implementation by itself; all five specifications are reviewed before
planning and delivery.

## Existing Product Boundary

Current production code already provides:

| Source | Available Capability |
| --- | --- |
| Workflow browser-launch settings | Current workflow-owned identity id, display name, persona, profile directory, fingerprint seed, locale, timezone, proxy, WebRTC, headed/headless and humanization settings. |
| `resetWorkflowBrowserIdentity(workflowId)` | Existing guarded identity reset that rotates identity/profile/fingerprint seed, preserves relevant preferences, appends migration notes and disables Run from selected. |
| Browser session manager | Retained browser sessions, retained-session state and an internal close-retained-session capability. |
| Run manager guards | Active workflow/profile conflict checks used by run and identity commands. |
| CloakBrowser diagnostics | Binary/profile/font/display/GeoIP/profile/session information, including values that must be sanitized before renderer display. |
| SQLite `runs` | Durable run status, timing, workflow snapshots, settings snapshots, sanitized outputs and errors. |
| Persisted output `browser_identity` | Sanitized observed browser identity evidence for a run. |
| Persisted evidence metadata | Evidence items and run links approved by specification 3. |
| Workflow migration notes | Rotation notes written during identity reset. |

Current production code does not provide:

- A standalone `Identities` route.
- A renderer-facing Identity Lab read model.
- A public IPC command to close a retained session.
- Current-identity run statistics filtered by both workflow and identity
  snapshot.
- Historical identity reference presentation from Evidence.
- Sanitized per-identity diagnostics DTOs designed for operator display.

## Chosen Approach

Use **Identity Read Model + Command-Owned Session Actions**.

The Electron backend owns an Identity Lab read-model service over workflows,
settings snapshots, persisted runs, evidence metadata, retained session state,
rotation notes and sanitized diagnostics. The renderer owns layout, selection,
filters and navigation. Mutating operations remain narrow backend commands with
the same guard semantics as the runner.

This approach was selected over:

| Alternative | Reason Not Chosen |
| --- | --- |
| Renderer aggregation over existing APIs | Forces the UI to join raw workflows, runs, evidence and diagnostics, which makes sanitization and identity filtering harder to audit. |
| New identity catalog/table | Adds lifecycle, migration, sync and ownership complexity before the product has a need for identities independent of workflows. |
| Settings-only identity panel | Hides run/evidence/diagnostics context and does not give operators a durable investigation workspace. |

## Scope

### Included

- New `Identities` route/page in the Mission Control shell.
- Sidebar order after this phase: `Overview`, `Workflows`, `Runs`,
  `Evidence`, `Schedules`, `Identities`, `Settings`.
- Current managed identity list, one row per workflow that currently owns a
  browser identity configuration.
- Read-only historical identity reference when an identity from Evidence or
  rotation history no longer matches a current managed identity.
- Current configured posture display: persona, session/profile reuse, proxy
  enabled with redacted origin/host, timezone/locale mode, GeoIP, WebRTC
  policy, headed/headless, humanization and font posture.
- Latest observed posture from the most recent matching `browser_identity`
  report, timestamped and labeled as observed evidence.
- Per-identity run summary: last run, recent failures in a rolling 24h UTC
  window and related evidence links.
- Sanitized diagnostics detail for the selected managed identity.
- Managed identity actions: `Open Workflow Settings`, `Open Evidence`, `Open
  Last Run`, `Diagnostics`, `Close Retained Session` and `Reset Identity`.
- Evidence Explorer `Open Identity` navigation for evidence items with an
  `identity_id`.
- Rotation history from workflow `migration_notes` entries typed `rotated`,
  bounded to the 20 most recent rotation records.
- Bounded empty/error states for missing workflow, missing profile, missing
  diagnostics, no runs, no evidence and historical identity references.

### Excluded

- New standalone identity table, catalog or identity lifecycle independent of
  workflows.
- `Create Identity`, identity cloning, identity groups, shared identity pools
  or a separate identity editor.
- Account binding, account-health modeling, continuity score or reuse score.
- IP address, ASN, latency, residential/mobile proxy classification, proxy
  reputation score, fingerprint score or fingerprint verdict.
- Network probes, live fingerprint tests or automatic diagnostics probes from
  the Identity Lab UI.
- Installing the CloakBrowser binary or cleaning up orphaned profiles from
  Identity Lab.
- Deleting profile data, cookies, local storage, evidence or historical runs.
- Opening raw profile directories, raw browser storage, cookies, tokens,
  credentials or proxy secrets.
- Launching a run directly from Identity Lab.

## Navigation And Workspace Ownership

After this phase is implemented, the active sidebar includes:

| Order | Navigation Label | Destination |
| --- | --- | --- |
| 1 | Overview | Durable operations dashboard. |
| 2 | Workflows | Workflow list and Graph Builder entry. |
| 3 | Runs | Live/session monitor plus focused durable-run receiver. |
| 4 | Evidence | Persistent evidence browsing and investigation. |
| 5 | Schedules | Schedule management and event history. |
| 6 | Identities | Current managed identity posture, diagnostics and session actions. |
| 7 | Settings | Existing app-level settings. |

### Ownership Rules

- `Identities` owns current managed identity inspection, sanitized
  diagnostics, retained-session close and identity reset actions.
- `Evidence` owns evidence browsing and artifact actions. It may deep-link to
  Identity Lab when evidence has an identity reference.
- `Runs` owns execution monitoring and durable run detail. Identity Lab links
  to Runs for last-run investigation but does not duplicate run detail.
- `Workflows` remains the destination for editing workflow settings and Graph
  Builder configuration.
- `Settings` remains the destination for app-level dependencies such as
  binary installation or orphaned-profile cleanup if those surfaces are added.

### Supported Navigation

| Origin | Action | Destination |
| --- | --- | --- |
| Evidence item with current `identity_id` | `Open Identity` | Identities route with the matching managed identity selected. |
| Evidence item with historical `identity_id` | `Open Identity` | Identities route in `Historical Identity Reference` mode. |
| Managed identity detail | `Open Evidence` | Evidence Explorer filtered by current `workflow_id` and `identity_id`. |
| Managed identity detail | `Open Last Run` | Runs focused durable-run receiver for the latest run matching current workflow and identity. |
| Managed identity detail | `Open Workflow Settings` | Existing workflow settings destination. |
| Historical identity reference | `Back to Evidence` | Evidence item/detail that opened the reference when available. |
| Historical identity reference | `Open Related Run` | Runs focused durable-run receiver when the run still exists. |
| Historical identity reference | `Open Related Workflow` | Existing workflow destination when the workflow still exists. |

## Identity Entity Model

### Managed Identity

A managed identity is the browser identity currently configured by a workflow.
It is not a separate persisted entity in this specification. The read model
derives managed rows from workflow settings and uses the current
`workflow_id` plus current `identity_id` as the stable UI target.

If a workflow lacks browser identity settings, it does not appear as a normal
managed identity row. Identity Lab may show a bounded empty/warning state that
points the operator to Workflow Settings when a workflow cannot produce a
managed identity summary.

### Historical Identity Reference

A historical identity reference is an identity id found in run/evidence data
or rotation history that no longer matches the workflow's current managed
identity. It is read-only and never gains managed actions.

Historical references may display sanitized fields available from evidence
  detail, run settings snapshot and rotation notes typed `rotated`, such as
  identity id, display name, workflow/run references and observed report
  timestamp. They do not query current diagnostics, close sessions or reset
  anything.

### Rotation Boundary

Identity reset rotates the current identity. Runs and evidence produced before
that reset keep their historical `identity_id`. Identity Lab does not relabel
old runs as belonging to the new identity.

Managed identity metrics only count runs whose historical snapshot matches the
current `workflow_id` and current `identity_id`. After reset, if no new run has
used the new identity, the detail says `No runs for this identity yet` even
when the workflow has older runs.

## Identity Lab Read Model

### Backend Request Shape

The renderer calls typed backend commands conceptually shaped as:

```text
getIdentityLabOverview({
  filters?,
  selected_target?,
  limits?
}) -> IdentityLabOverview

getIdentityLabDetail({
  target
}) -> IdentityLabDetail
```

`target` can identify either:

- A managed identity by current `workflow_id` and current `identity_id`.
- A historical identity reference by `identity_id` plus evidence/run/workflow
  reference context.

The backend validates request size, applies bounded limits and returns only
sanitized fields. The renderer does not fetch raw diagnostics or raw run
outputs to derive identity state.

### Overview Shape

```text
IdentityLabOverview {
  generated_at
  items: ManagedIdentitySummary[]
  selected?: IdentityLabDetail
  counts: {
    managed_identities
    active_retained_sessions
    identities_with_warnings
    identities_with_recent_failures
  }
  data_warnings: IdentityLabDataWarning[]
}
```

The default list is bounded and supports search/filter by workflow name,
display name, persona, identity id, session state, warning state and recent
failure state. Backend validation caps list limits so a large local database
cannot force unbounded renderer work.

### Managed Identity Summary

Each managed row includes:

```text
ManagedIdentitySummary {
  workflow_ref
  identity_ref
  display_name?
  persona_id?
  persona_label?
  short_identity_id
  session_mode
  profile_reuse
  retained_session: { active, since? }
  configured_posture_summary
  last_run?
  recent_failures_24h
  warning_badges[]
}
```

`short_identity_id` is display-only. Any command or navigation target uses the
full backend-provided identifiers.

### Detail Shape

`IdentityLabDetail` is one of:

```text
ManagedIdentityDetail
HistoricalIdentityReference
```

A managed detail includes:

- Workflow owner and current identity fields.
- Session continuity and run-from-selected impact.
- Configured posture.
- Latest observed browser identity report.
- Last run and recent failure summary.
- Evidence link summary.
- Rotation history from `migration_notes` entries typed `rotated`.
- Sanitized diagnostics summary.
- Action availability and disabled reasons.

A historical reference includes:

- Historical identity id and display context.
- Evidence/run/workflow references that led to the reference.
- Sanitized observed fields available from persisted evidence or snapshots.
- Historical evidence/run navigation actions only.

## Run And Evidence Association

### Current Identity Filtering

For a managed identity, all run-derived metrics use exact current identity
matching:

```text
run.workflow_id == current workflow_id
and run.settings_snapshot.browser_launch.identity_id == current identity_id
```

If a persisted run lacks a parseable settings snapshot, the backend may fall
back to a matching sanitized `browser_identity` output only when it also has a
safe workflow/run association. Ambiguous rows are excluded and counted in
`data_warnings` instead of being guessed into the identity.

### Last Run

`Last Run` is the most recent durable run matching the current workflow and
identity, ordered by started time with deterministic run id tie-breaking. It
shows status and time. If none exists, the UI states `No runs for this
identity yet`.

### Recent Failures

`Recent Failures` counts terminal failed runs in the rolling UTC window:

```text
generated_at - 24 hours <= run.finished_at <= generated_at
```

Only runs matching the current workflow and identity are counted. Active runs
do not count as failures until terminal failure is persisted.

### Latest Observed Report

`Latest Observed` comes from the most recent matching run that contains a
valid sanitized `browser_identity` output. It is timestamped and labeled as
observed evidence from a run, not a live probe.

### Evidence Links

Managed identity detail links to Evidence filtered by current `workflow_id`
and current `identity_id`. The evidence summary prioritizes `browser_identity`
and `screenshot` items when the Evidence API returns preview metadata. If no
metadata exists, the UI shows a link-only state rather than fabricating a
preview.

Historical identity references link Evidence by the historical identity id and
the source references available from the evidence detail or rotation history.

## Diagnostics

Diagnostics are a sanitized read-only summary. Opening `Diagnostics` displays
the diagnostics data included in the loaded Identity Lab DTO or refreshed by
the page read model. It does not install binaries, run network probes or
mutate profile state.

### Allowed Diagnostics Fields

| Area | Displayed Fields |
| --- | --- |
| Browser binary | Installed status and version when available. |
| Headed display | Availability status and warning when headed runs are configured but no display is available. |
| GeoIP dependency | Available/unavailable state. |
| Profile | Presence, approximate size and active retained-session state. |
| Fonts | Status, hash, family coverage and shared-warning state. |

### Redacted Diagnostics Fields

Identity Lab does not display:

- Absolute binary, profile, cache or font filesystem paths.
- Raw directory listings.
- Profile contents.
- Browser storage, cookies, tokens or credentials.
- Proxy credentials.
- Local machine usernames or home-directory paths.

If diagnostics are unavailable, the detail shows a bounded warning and leaves
identity actions governed by command guard responses.

## Actions And Guards

The backend remains authoritative for every action. UI disabled states are
helpful explanations, not security boundaries.

### Managed Actions

| Action | Availability | Behavior |
| --- | --- | --- |
| `Open Workflow Settings` | Enabled when workflow still exists. | Navigates to the existing workflow settings destination. |
| `Open Evidence` | Enabled for current managed identity. | Opens Evidence filtered by current `workflow_id` and `identity_id`. |
| `Open Last Run` | Enabled when a matching last run exists. | Opens Runs focused on that durable run. |
| `Diagnostics` | Enabled for managed identity detail. | Opens the sanitized diagnostics drawer/panel. |
| `Close Retained Session` | Enabled when the current identity has an active retained session and no active run owns that workflow/profile. | Closes the browser context and clears retained-session state in memory only. |
| `Reset Identity` | Enabled only when there is no active run/profile conflict and no retained session. | Requires confirmation, then calls the existing reset behavior for the workflow. |

### Close Retained Session

`Close Retained Session` does not delete:

- Persistent profile data.
- Cookies or login state.
- Identity settings.
- Evidence files.
- Historical runs.

After success, Identity Lab refreshes the read model. If the only reset blocker
was the retained session, `Reset Identity` becomes available after refresh.

### Reset Identity

`Reset Identity` is available only for current managed identities. It requires
confirmation that names the workflow and current identity. The confirmation
copy states that the action rotates the identity/profile/fingerprint seed,
preserves non-storage preferences according to existing backend behavior,
disables Run from selected and does not delete historical evidence.

Reset is disabled with a specific reason when:

- The workflow currently has an active run.
- The profile is owned by an active run.
- A retained session is still open.
- The workflow was deleted or the identity no longer matches current settings.

If a retained session is the blocker, the UI presents `Close Retained Session`
as the next available action. After reset succeeds, Identity Lab refreshes and
selects the new current identity. The old identity remains reachable only
through Evidence or rotation history as a historical reference.

### Historical Reference Actions

Historical identity references support only:

- `Back to Evidence` when source evidence context exists.
- `Open Related Run` when the run still exists.
- `Open Related Workflow` when the workflow still exists.

They do not support diagnostics, close retained session, reset, settings edit
or any profile mutation.

## UI And Interaction Design

Identity Lab uses the Mission Control operational UI language: dense,
scannable, dark, table/detail oriented and consistent with the existing shell.
It is not a marketing page.

### Layout

- A left/list or table region shows managed identities.
- A right/detail region shows the selected managed identity or historical
  reference.
- On compact widths, the detail becomes a drill-in panel while preserving the
  selected list state.
- A refresh control reloads the read model. The page also refreshes after
  close-session and reset actions, and after terminal run state changes when
  the shared run state subscription already provides that signal.

### List Row Content

Each managed identity row displays:

- Workflow name.
- Display name or persona label.
- Short identity id.
- Session mode/profile reuse.
- Retained-session status.
- Configured posture chips.
- Last run status and time.
- Recent failure count.
- Warning badges.

Rows must avoid implying live verification. For example, proxy and fingerprint
values are configuration/diagnostic posture unless backed by latest observed
run evidence.

### Managed Detail Sections

| Section | Content |
| --- | --- |
| Current Profile | Identity id, profile label, display name, persona and workflow owner. |
| Session Continuity | Retained session state, profile reuse and Run from selected impact after reset. |
| Configured Posture | Proxy redacted host/origin, timezone/locale mode, GeoIP, WebRTC policy, headed/headless, humanization and font posture. |
| Latest Observed | Timestamped browser identity report from the latest matching run, when present. |
| Evidence | Prioritized browser identity and screenshot metadata plus `Open Evidence`. |
| Rotation History | Up to 20 recent `rotated` migration notes with old/new identity ids, timestamp, source/reason when present and evidence links for old ids when available. |
| Diagnostics | Sanitized diagnostics drawer/panel. |
| Actions | Available commands and disabled reasons. |

### Historical Reference Detail

The historical reference view clearly labels the identity as historical and
read-only. It shows the source evidence/run context, observed fields available
from persisted data and the limited navigation actions. It does not occupy the
managed identity list as an editable row.

### Empty States

Identity Lab includes explicit empty states for:

- No workflows with browser identity settings.
- No runs for the selected current identity.
- No recent evidence for the selected identity.
- Missing diagnostics.
- Missing profile.
- Missing browser binary.
- Historical identity no longer attached to a workflow.

Empty states point to the correct workspace action where one exists, such as
Workflow Settings or Settings, without hiding unavailable operations behind
disabled primary buttons.

## Error Handling

Identity Lab surfaces backend command/read errors with action-specific copy:

| Error | UI Behavior |
| --- | --- |
| Active run conflict | Disable or fail the action with the workflow/run conflict reason. |
| Retained session conflict | Explain that the session must be closed before reset and offer close-session when available. |
| Profile not found | Show diagnostics/profile warning without deleting or recreating data. |
| Workflow deleted | Show stale selection state and return to list/empty state on refresh. |
| Diagnostics unavailable | Show diagnostics warning and keep non-diagnostic navigation usable. |
| Malformed run snapshot | Exclude from current identity metrics and count a data warning. |
| Missing evidence file | Keep evidence metadata/link state from Evidence rules; do not break identity detail. |

Failed close-session or reset commands do not optimistically update the UI. The
page refreshes only after a successful command or explicit reload.

## Security And Privacy

Identity Lab is allowed to help operators reason about realistic browser
identity posture for authorized testing, but it must not expose raw local or
secret material.

The renderer must not receive:

- Absolute local paths.
- Proxy passwords or full credential-bearing proxy URLs.
- Raw cookies, local storage, tokens or account secrets.
- Raw profile contents.
- Arbitrary raw run outputs.
- Browser fingerprint verdicts or reputation values not produced by a trusted
  backend source.

Proxy display is limited to enabled/off plus redacted host/origin. Font display
is limited to status, hash, family coverage and shared warning. Diagnostics
paths remain backend-only.

## Refresh And Performance

Identity Lab reads are bounded. The overview command returns list limits,
counts and selected detail rather than unbounded run/evidence history.

The page refreshes:

- On route entry.
- On explicit operator refresh.
- After successful close retained session.
- After successful identity reset.
- When a current-process run transitions to terminal state and the existing run
  subscription makes that visible.

The page does not poll full run history aggressively. Expensive artifact and
evidence browsing remains in Evidence Explorer.

## Testing Scope

Implementation planning must include focused tests for:

- Backend read model filtering by current `workflow_id` and current
  `identity_id`.
- Exclusion of old identity runs from current identity last-run, failure and
  latest-observed metrics after reset.
- Historical identity reference creation from Evidence when the identity no
  longer matches current workflow settings.
- Rotation history parsing for `rotated` migration notes and 20-item cap.
- Diagnostics sanitization, including removal of absolute paths and proxy
  credentials.
- Close-retained-session command success, guard failures and refresh behavior.
- Reset identity action availability, confirmation, conflict handling and
  refresh behavior.
- IPC/preload contract coverage for read DTOs and action commands.
- Renderer list/detail states, disabled reasons, diagnostics drawer,
  historical reference mode and navigation to Evidence/Runs/Workflows.
- Regression coverage for malformed run snapshots and missing evidence files.

## Acceptance Criteria

- `Identities` appears in the approved sidebar order only after Evidence has
  been implemented.
- Operators can select a current managed identity and see truthful configured
  posture, latest observed evidence, last run, recent failures, evidence links,
  diagnostics and rotation history.
- Current identity metrics ignore runs from previous identities after reset.
- Evidence items with `identity_id` can open Identity Lab as either a managed
  identity or historical reference.
- `Close Retained Session` closes only in-memory retained browser context and
  does not delete profile data.
- `Reset Identity` is guarded, confirmed and unavailable while an active run or
  retained session makes the backend reject it.
- Diagnostics shown in the renderer are sanitized and never expose absolute
  paths, credentials or raw profile/browser storage.
- Historical references are read-only and cannot mutate current workflow
  identity state.
- No identity catalog/table, identity editor or run launch surface is added by
  this specification.
