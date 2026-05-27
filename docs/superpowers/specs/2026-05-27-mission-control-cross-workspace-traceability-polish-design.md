# Mission Control Cross-Workspace Traceability And Polish Design

Date: 2026-05-27

## Status

Approved design for a written specification on 2026-05-27.

This is specification 5 of the Mission Control production adoption program. It
is ready for user review before implementation planning begins. Per the
approved program gate, no implementation planning or production code changes
begin until all program specifications are written and approved.

## Goal

Finish the Mission Control suite by making the workspaces specified in the
previous phases feel like one coherent application. This specification defines
cross-workspace navigation targets, bounded command/search behavior, Settings
workspace parity based on real capabilities, compact desktop rules and final
traceability links.

The completed feature must:

- Establish one final sidebar order and entry-point rule for the full suite.
- Provide a typed in-memory navigation target contract between workspaces.
- Make stale or missing targets explicit instead of silently failing.
- Standardize the shell command bar and bounded entity search.
- Upgrade Settings to a real Mission Control workspace without adding policy,
  notification or appearance systems that do not exist.
- Complete approved traceability links between Overview, Workflows, Graph
  Builder, Runs, Evidence, Schedules, Identities and Settings.
- Standardize compact desktop behavior at `1024x768`.
- Preserve all ownership and security boundaries approved in specifications
  1-4.

## Program Position

The Mission Control program is specified in this order:

| Sequence | Specification | Boundary |
| --- | --- | --- |
| 1 | Mission Control Foundation And Existing Workspace Adoption | Production design system, shell, current workspaces and Graph Builder overlays. |
| 2 | Operations Overview | Durable operations dashboard and initial run/evidence reference boundary. |
| 3 | Evidence Explorer | Standalone evidence investigation, safe artifact interactions and bundle export. |
| 4 | Identity Lab | Standalone identity/session posture and diagnostics workspace. |
| 5 | Cross-Workspace Traceability And Polish | Final deep links, navigation consistency, compact behavior and suite parity. |

This specification assumes specifications 1-4 have been implemented or are
planned together. It does not add a new domain subsystem. It is the integration
and polish layer that makes the approved surfaces navigable, testable and
consistent.

## Existing Product Boundary

After specifications 1-4, the product is expected to have:

| Area | Approved Capability |
| --- | --- |
| Shell/design system | Mission Control shell, tokens, app navigation and existing workspace adoption. |
| Workflows | Workflow list/detail, Graph Builder, Workflow Settings and full-run launch confirmation. |
| Overview | Durable operations dashboard, attention feed, recent evidence and focused run receiver links. |
| Runs | Live/session monitoring plus bounded focused durable-run detail receiver. |
| Evidence | Durable Evidence Explorer, evidence detail, screenshot preview, reveal/export commands and evidence filters. |
| Schedules | Existing schedule management and event history under the Mission Control shell. |
| Identities | Identity Lab for current managed identities, historical references, diagnostics and guarded identity/session actions. |
| Settings | Existing app-level settings, graph autosave and graph shortcut guidance, plus backend diagnostics commands already available. |

Remaining gaps are integration gaps:

- Workspace-to-workspace navigation semantics are spread across individual
  specs.
- Focus targets need a common stale/missing behavior.
- The command bar and global search need bounded semantics.
- Settings needs suite-level parity without pretending to own workflow policy
  or future global policy systems.
- Compact desktop behavior needs one final rule set.

## Chosen Approach

Use **Integration Contract + Polish Pass**.

The renderer owns a typed in-memory navigation target contract and shell-level
command/search orchestration. Each workspace remains responsible for resolving
and rendering its own targets through its existing approved read models and
commands. Settings is improved only around real app-level preferences,
diagnostics and maintenance operations.

This approach was selected over:

| Alternative | Reason Not Chosen |
| --- | --- |
| Settings and shell feature spec | Gives Settings polish but leaves deferred cross-workspace navigation behavior unresolved. |
| Full URL/protocol router | Adds persistence, OS link handling and restart semantics that the current Electron app does not need for this suite delivery. |
| Full suite parity expansion | Pulls in policy editors, retention settings, notification inboxes and appearance systems without backend truth. |

## Scope

### Included

- Final sidebar order: `Overview`, `Workflows`, `Runs`, `Evidence`,
  `Schedules`, `Identities`, `Settings`.
- `Overview` as the default entry point once all Mission Control workspaces
  exist.
- Typed in-memory navigation target contract for workflow, run, evidence,
  identity, schedule and graph issue/node targets.
- Stale/missing target states for every targetable workspace.
- Consistent focus and clear-focus behavior when a workspace opens with a
  target.
- Bounded command bar and search across approved entity read models.
- Alerts shortcut behavior that opens/focuses the Overview attention feed.
- Settings parity for existing app preferences, diagnostics, environment
  readiness and guarded maintenance commands.
- Final traceability links between Overview, Runs, Evidence, Identity Lab,
  Schedules, Workflows and Graph Builder overlays.
- Shared compact desktop behavior for `1024x768`.
- Focused tests and visual/regression checks for integration behavior.

### Excluded

- URL-based router, OS protocol deep links, browser address-bar routing or
  persisted navigation targets across app restart.
- Global command palette, hotkey registry, saved searches or command macros.
- Notification inbox, alert assignment, acknowledgement, comments or incident
  workflow.
- Global policy engine, policy editor, global allowlist editor or evidence
  retention editor.
- Appearance/theme switch or custom theming UI.
- New evidence item types, log explorer, challenge observation explorer or raw
  payload browser.
- Case management, annotations, collaboration, labels or workflow assignment.
- New runner behavior, graph action types, scheduling semantics, evidence
  generation semantics or browser identity lifecycle rules.

## Final Information Architecture

The full Mission Control sidebar is:

| Order | Navigation Label | Destination |
| --- | --- | --- |
| 1 | Overview | Durable operations dashboard and default entry point. |
| 2 | Workflows | Workflow library and Graph Builder entry. |
| 3 | Runs | Live/session monitoring and focused durable-run detail. |
| 4 | Evidence | Durable evidence browsing and investigation. |
| 5 | Schedules | Schedule management and event history. |
| 6 | Identities | Managed browser identity posture, diagnostics and session actions. |
| 7 | Settings | App-level preferences, diagnostics, environment and maintenance. |

The application opens to `Overview` once all suite workspaces exist. The
implementation may continue using internal component/file names such as
`RunCenterPage` if renaming would add churn without user-facing benefit, but
user-facing navigation and page labels use `Runs`.

## Navigation Target Contract

### Contract Shape

The renderer owns a discriminated in-memory target model conceptually shaped
as:

```text
MissionControlTarget =
  | { type: "overview"; focus?: "attention" | "recent_evidence" | "live_runs" }
  | { type: "workflow"; workflow_id: string; mode?: "list" | "detail" | "graph" | "settings" }
  | { type: "run"; run_id: string; step_id?: string; evidence_id?: string }
  | { type: "evidence"; evidence_id?: string; filters?: EvidenceTargetFilters }
  | { type: "identity"; target: ManagedIdentityTarget | HistoricalIdentityTarget }
  | { type: "schedule"; schedule_id?: string; schedule_event_id?: string }
  | { type: "graph_issue"; workflow_id: string; node_id?: string; issue_id?: string; run_id?: string; evidence_id?: string }
```

`EvidenceTargetFilters` may include exact `workflow_id`, `run_id`,
`identity_id`, `kind` and source filters already supported by Evidence
Explorer.

`ManagedIdentityTarget` uses current `workflow_id` plus current `identity_id`.
`HistoricalIdentityTarget` uses historical `identity_id` plus available
evidence/run/workflow context.

The exact TypeScript names are implementation details. The behavioral contract
is that navigation targets are typed, explicit and owned by the renderer shell.

### Non-Goals

Navigation targets are not:

- URL query strings.
- OS protocol links.
- Persisted app state after restart.
- Security boundaries.
- A backend callback mechanism.

Backend read models may return navigation references, but the renderer decides
how to route them.

### Target Resolution Rules

Each workspace resolves its own target after navigation:

- If the target exists, the page focuses the matching item/detail.
- If the target requires filters, the page applies a visible focus/filter chip
  and provides a clear-focus action.
- If the target is stale or missing, the page shows a bounded stale state with
  the target type and safe identifier.
- If the target is malformed, the shell rejects navigation and keeps the user
  on the current page with an error toast or inline message.
- A failed target does not silently redirect to a different workspace.

Targets may be cleared by selecting a normal list item, changing filters or
using a clear-focus control. Clearing a target returns the page to its default
list/detail behavior without destroying unrelated page state.

### Stale And Missing States

| Target Type | Stale/Missing State |
| --- | --- |
| Workflow | Workflow deleted or unavailable; offer return to Workflow list. |
| Run | Run not found or not persisted; show missing run receiver state. |
| Evidence | Evidence item missing, malformed or artifact unavailable; preserve safe metadata when available. |
| Identity | Resolve to historical reference when possible; otherwise show missing identity reference. |
| Schedule | Schedule or event unavailable; offer return to schedule list/history. |
| Graph issue/node | Workflow opens if available, but node/issue not found is shown in Graph Builder context. |

## Cross-Workspace Traceability

### Required Links

| Origin | Action | Destination |
| --- | --- | --- |
| Overview attention item | Open target | The relevant Runs, Workflows, Schedules, Evidence or Identities target when the item has one. |
| Overview recent evidence | Open evidence | Evidence detail by `evidence_id`. |
| Overview live run | Open run | Runs focused on the active or durable run reference. |
| Overview upcoming schedule | Open schedule | Schedules focused on `schedule_id`. |
| Runs detail | `Open Workflow` | Workflow detail/Graph Builder for the run workflow when it still exists. |
| Runs detail | `Open Evidence` | Evidence filtered by `run_id` or focused by `evidence_id` when present. |
| Runs detail | `Open Identity` | Identity Lab managed or historical target when identity context is available. |
| Evidence detail | `Open Run` | Runs focused durable-run receiver. |
| Evidence detail | `Open Workflow` | Workflow destination when workflow still exists. |
| Evidence detail | `Open Identity` | Identity Lab managed or historical target. |
| Identity detail | `Open Evidence` | Evidence filtered by current `workflow_id` and `identity_id`. |
| Identity detail | `Open Last Run` | Runs focused on the latest matching run. |
| Identity detail | `Open Workflow Settings` | Workflow Settings for the owning workflow. |
| Schedules event/history | `Open Run` | Runs focused on `run_id` when the event has one. |
| Schedules event/history | `Open Workflow` | Workflow destination when workflow still exists. |
| Graph validation/failure overlay | `Go to Node` | Graph Builder focused on the affected node. |
| Graph validation/failure overlay | `Open Evidence` | Evidence by `evidence_id` or filtered by `run_id` when available. |
| Graph validation/failure overlay | `Open Run` | Runs focused on run context when available. |

### Link Truthfulness

Links appear only when the target can be constructed from approved data. A
disabled future-only link is not used to advertise a feature that has no real
target. When a target might be stale because the underlying row was deleted
after the source read, the link can remain visible, but the destination must
show the explicit stale state after resolution.

### Graph Overlay Integration

The Graph Builder launch and validation/failure overlays remain the scoped
interactions approved in specification 1. This specification only extends
traceability after Evidence and Runs targets exist:

- `Go to Node` focuses an existing node and preserves its validation/failure
  state plus selected state.
- `Open Evidence` is shown only when there is an `evidence_id` or `run_id`
  that Evidence can resolve.
- `Open Run` is shown only when a run context exists.
- Technical details stay collapsed by default and do not become a raw payload
  browser.

## Command Bar And Search

### Shell Command Bar

Every workspace uses one command bar pattern:

- Page context/title.
- Bounded search/command input.
- Environment badge.
- Alerts shortcut.
- Page-specific primary action.

The command bar adapts to compact desktop but does not disappear. On narrow
desktop, search may collapse behind an icon control with an accessible label.

### Bounded Search

Search opens approved entities only:

| Entity | Search Source |
| --- | --- |
| Workflow | Workflow list/read model. |
| Run | Runs/operations read model. |
| Evidence | Evidence read model. |
| Schedule | Schedule list/event read model. |
| Identity | Identity Lab read model. |

Search results include:

- Entity type label.
- Primary display name or id.
- Status or timestamp when relevant.
- Safe secondary context.
- Typed navigation target.

Search does not index or expose:

- Raw run outputs.
- Raw evidence payloads.
- Artifact file contents.
- Browser profile paths or storage.
- Proxy credentials.
- Local filesystem paths.
- Cookies, tokens or account secrets.

### Alerts Shortcut

The alerts shortcut opens `Overview` with the attention feed focused or
filtered. It does not introduce a notification inbox, unread count system,
assignment workflow or acknowledgement model.

### Primary Actions

| Workspace | Primary Action |
| --- | --- |
| Overview | `Open Workflows`. |
| Workflows | `New Workflow`. |
| Graph Builder | `Launch Run` for full graph runs. |
| Runs | `Refresh`; active-run `Stop` remains contextual to the selected active run, not a global page primary. |
| Evidence | `Export Selected` when selected exportable evidence exists. |
| Schedules | `New Schedule`. |
| Identities | `Refresh`. |
| Settings | `Save Changes` only when there are pending app-level preference changes. |

Primary actions must not launch hidden workflows that bypass the approval and
confirmation semantics already approved in earlier specs.

## Settings Parity

Settings becomes a complete app-level Mission Control workspace while staying
inside real product capability.

### Ownership

Settings owns:

- App-level preferences.
- App-level diagnostics.
- Environment readiness.
- Guarded maintenance commands.

Settings does not own:

- Per-workflow Browser Launch configuration.
- Per-workflow Run Policy.
- Per-workflow Environment variables.
- Workflow identity reset.
- Identity diagnostics for a selected workflow identity.
- Evidence investigation.

Those remain in Workflow Settings, Identity Lab and Evidence Explorer.

### Sections

| Section | Included Behavior |
| --- | --- |
| Preferences | Graph autosave and graph shortcut/help guidance. Command behavior may be included only if persistence and behavior already exist. |
| Diagnostics | CloakBrowser wrapper/binary status, headed display availability, GeoIP availability, font diagnostics summary, profile diagnostics summary and last smoke result when available. |
| Environment | Safe runtime/environment badges and safe app data/evidence location summaries when backend-safe copy/reveal behavior exists. |
| Maintenance | `Install CloakBrowser Binary` and `Cleanup Orphaned Profiles` when existing backend commands provide guards, confirmation and bounded results. |

### Explicit Deferrals

Settings does not add:

- Global policy editor.
- Global domain allowlist editor.
- Evidence retention editor.
- Notification preferences.
- Appearance/theme switch.
- Operator profile management.
- Raw app data path browser.

If a Stitch Settings region implies one of those deferred systems, the
production implementation omits it or renders only a truthful read-only summary
of existing settings.

### Diagnostics Safety

Settings diagnostics follow the same safety posture as Evidence and Identity
Lab:

- Do not expose proxy credentials.
- Do not expose raw browser profile contents.
- Do not expose cookies, local storage, tokens or account secrets.
- Do not expose absolute local paths unless the value is already a safe,
  intended app-level path and is returned by a backend command designed for
  display.
- Prefer safe copy/reveal commands over raw path display.

## Compact Desktop Behavior

The required compact desktop target is `1024x768`. There is no phone/mobile
requirement in this program.

### Global Rules

- Sidebar collapses to an icon rail with accessible labels and tooltips.
- Command bar keeps page title/context and primary action visible.
- Search may collapse behind an accessible icon control.
- Tables hide secondary metadata columns before primary names, status and
  actions.
- Split list/detail pages become drill-in, drawer or stacked views.
- Detail drawers preserve focus and provide a clear return path.
- Dialogs and overlays are scrollable and maintain focus trap.
- No main workspace has incoherent horizontal overflow at `1024x768`.

### Workspace-Specific Rules

| Workspace | Compact Rule |
| --- | --- |
| Overview | KPI/dashboard regions become two columns or prioritized stack; attention remains reachable near the top. |
| Workflows | Table metadata collapses; selected preview becomes drawer/drill-in. |
| Graph Builder | Sidebar palette and inspector become drawers; canvas remains primary. |
| Runs | Run list/detail becomes drill-in or stacked with the selected run clearly indicated. |
| Evidence | Grid/list and preview detail become drill-in or drawer; artifact actions remain reachable. |
| Schedules | Timeline/history metadata stacks; event details become drawer/drill-in. |
| Identities | Identity list/detail becomes drill-in or drawer; action guards remain visible. |
| Settings | Local settings navigation becomes a vertical segmented list or stacked tabs. |

## Error Handling

Integration errors are surfaced at the workspace that owns the failed target or
action.

| Error | Required Behavior |
| --- | --- |
| Invalid target payload | Shell rejects navigation and keeps current workspace. |
| Missing target row | Destination page shows stale/missing state. |
| Deleted workflow | Related pages show workflow unavailable and preserve safe historical context. |
| Missing run | Runs receiver shows missing durable run state. |
| Missing evidence | Evidence shows missing evidence or missing file state according to specification 3. |
| Historical identity | Identity Lab opens read-only historical reference when enough context exists. |
| Missing graph node | Graph Builder opens workflow context and shows node not found. |
| Search source failure | Search shows partial/unavailable source state without implying no results. |
| Maintenance command failure | Settings shows action-specific backend error and does not optimistically update. |

## Security And Privacy

This specification does not loosen any earlier security boundary. Cross-linking
and search must use safe references, not raw payloads.

The renderer must not receive new broad raw data to support global search or
deep links. Each result or target uses existing approved read models, sanitized
summaries and opaque identifiers.

Specifically excluded from command search and traceability links:

- Raw run outputs.
- Raw artifact file contents.
- Browser profile storage.
- Cookies, tokens or credentials.
- Proxy credentials.
- Absolute local paths unless intentionally returned by a backend-safe
  app-level diagnostics command.

Destructive and maintenance actions continue to require confirmations and
backend guard validation.

## Data Flow And Ownership

The integration layer follows this ownership model:

| Unit | Responsibility |
| --- | --- |
| App shell/navigation state | Current workspace, pending target, command bar, alerts shortcut and bounded search orchestration. |
| Workspace pages | Resolve their own targets, render focused/stale states, clear focus and own page-specific actions. |
| Backend read models | Provide sanitized summaries, references and supported navigation targets. |
| Backend commands | Own filesystem, maintenance, evidence, session and destructive operations. |
| Tests | Verify target routing, stale handling, search safety and compact layout behavior. |

The renderer may keep transient target state in memory. It does not write a
navigation history table or restore the last target after restart in this
phase.

## Testing Scope

Implementation planning must include focused tests for:

- Final sidebar order and `Overview` default entry point.
- Typed target routing for workflow, run, evidence, identity, schedule and
  graph issue targets.
- Stale/missing target rendering in each destination workspace.
- Focus/filter chips and clear-focus behavior.
- Overview attention/evidence/schedule/run navigation.
- Runs to Workflow/Evidence/Identity navigation.
- Evidence to Run/Workflow/Identity navigation.
- Identity to Evidence/Last Run/Workflow Settings navigation.
- Schedule event to Run/Workflow navigation.
- Graph overlay `Go to Node`, `Open Evidence` and `Open Run` visibility and
  routing.
- Command bar primary action availability per workspace.
- Search result typing, routing and sanitization.
- Alerts shortcut to Overview attention focus.
- Settings section gating for real preferences, diagnostics, environment and
  maintenance commands.
- Settings confirmation/error handling for install and cleanup operations.
- Compact desktop layout at `1024x768`, including no incoherent horizontal
  overflow in primary workspaces.

Visual/regression checks must cover at least:

- A wide desktop viewport.
- `1024x768` compact desktop.
- Representative list/detail workspace.
- Graph Builder overlay.
- Settings workspace.

## Acceptance Criteria

- The final sidebar order is `Overview`, `Workflows`, `Runs`, `Evidence`,
  `Schedules`, `Identities`, `Settings`.
- `Overview` is the default entry point after the full suite exists.
- Cross-workspace navigation uses typed in-memory targets and does not require
  URL/protocol routing.
- Missing or stale targets show explicit destination-owned states.
- Command search opens only approved sanitized entity summaries.
- Alerts shortcut opens or focuses Overview attention, without creating a
  notification inbox.
- Settings exposes real app-level preferences, diagnostics, environment and
  guarded maintenance only.
- Settings does not add global policy, evidence retention, notification or
  appearance systems.
- Final traceability links work across Overview, Runs, Evidence, Identities,
  Schedules, Workflows and Graph Builder overlays when references exist.
- Compact desktop behavior is consistent at `1024x768` with no incoherent
  horizontal overflow.
- No new evidence types, raw payload browser, incident workflow, identity
  catalog, runner behavior or scheduling semantics are added by this
  specification.
