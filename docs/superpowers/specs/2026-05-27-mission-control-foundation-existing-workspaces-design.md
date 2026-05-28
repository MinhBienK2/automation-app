# Mission Control Foundation And Existing Workspace Adoption Design

Date: 2026-05-27

## Status

Approved design for a written specification on 2026-05-27.

Approved by the user on 2026-05-27.

It is the first implementation-oriented specification in the wider Mission
Control production adoption program. The user subsequently selected a program
gate: all Mission Control specifications listed below must be written and
approved before implementation planning or production code changes begin.

## Goal

Adopt the Mission Control visual system and operating shell in the production
Electron renderer for every currently supported workspace, without claiming or
building product capabilities that do not yet exist.

The implementation produced from this spec must:

- Replace the current Supabase-inspired production visual direction with the
  approved Mission Control direction.
- Present one coherent desktop shell and component language across
  `Workflows`, workflow detail / Graph Builder, `Runs`, `Schedules`,
  `Settings`, and their dialogs and feedback states.
- Rename the current `Run Center` user-facing navigation/page label to `Runs`.
- Add a full-run `Launch Run` confirmation interaction and a focused
  validation/runtime failure detail interaction in Graph Builder using current
  workflow, settings, validation, and run-state data.
- Preserve current product behavior, IPC boundaries, persistence models,
  runner semantics, security scope, and auditability unless a separately
  approved implementation plan identifies a necessary correction.

## Program Context

The completed Stitch suite defines a broader Mission Control product concept
with ten desktop screens/states:

1. Operations Dashboard.
2. Workflow Library.
3. Graph Builder.
4. Run Center.
5. Evidence Explorer.
6. Schedules.
7. Identity Lab.
8. Settings.
9. Graph Builder with Launch Run overlay.
10. Graph Builder with Validation / Failure Detail overlay.

The current application already implements workflow list/detail authoring,
run monitoring, scheduling, settings, per-workflow browser identity
configuration, runtime evidence generation, and workflow run/validation issue
presentation. It does not currently implement standalone `Overview`,
`Evidence`, or `Identities` workspaces.

The full production adoption program is intentionally split into bounded specs:

| Sequence | Specification Area | Outcome |
| --- | --- | --- |
| 1 | Mission Control Foundation And Existing Workspace Adoption | New production design system and coherent UI for existing behavior. |
| 2 | Operations Overview | New dashboard workspace over approved operational data sources. |
| 3 | Evidence Explorer | Standalone artifact/evidence navigation, queries, and interactions. |
| 4 | Identity Lab | Standalone identity/session posture and diagnostics workspace. |
| 5 | Cross-Workspace Traceability And Polish | Navigation, deep links, compact behavior, consistency, and final suite parity. |

This specification covers sequence item 1 only. It creates a production UI
foundation that later specs can extend without mixing unapproved capability
work into a styling migration. Sequence does not authorize implementation
before the remaining program specifications have been approved.

## Chosen Approach

Use **Functional Mission Control Adoption**.

The renderer adopts the new shell, tokens, components, existing-page styling,
and two graph interaction overlays in one coherent delivery. It does not add
hidden backend groundwork or render controls for future workspaces.

This approach was selected over:

| Alternative | Reason Not Chosen |
| --- | --- |
| UI adoption plus unrendered query/API groundwork | Introduces contracts before the data and UX requirements for Overview, Evidence Explorer, or Identity Lab have been approved. |
| Vertical slice adoption for only Workflows and Graph Builder | Leaves production showing conflicting visual systems across existing pages. |
| Full concept-suite implementation in one spec | Couples shell migration to several new domain/query/workspace decisions and is too broad for reliable implementation and review. |

## Scope

### Included

- Replacement of root `DESIGN.md` with a Mission Control production design
  system aligned to the approved Stitch direction and production UI rules.
- Mission Control styling/layout adoption for:
  - App shell and collapsible sidebar.
  - Workflow list / management screen.
  - Workflow detail and Graph Builder.
  - Current cross-workflow run monitoring page, relabeled `Runs`.
  - Schedules page, create/edit dialog, and history presentation.
  - App-level Settings page.
  - Existing Workflow Settings, workflow package, schedule, confirmation,
    toast, loading, empty, and error surfaces that are visible within these
    workflows.
- A `Launch Run` confirmation dialog for full graph runs from workflow detail.
- A focused dialog/details interaction for graph validation issues and
  runtime/system failures already represented by the current issue model.
- Responsive compact-desktop treatment for existing screens and dialogs.
- Focused renderer tests and visual verification required for this migration.
- Current source-of-truth documentation updates required when implementation
  changes current user-visible behavior or ownership.

### Excluded

- `Overview` / Operations Dashboard route, navigation item, or data model.
- Standalone `Evidence` / Evidence Explorer route, query API, deep-link model,
  artifact browsing page, or evidence-opening controls that do not already
  work.
- Standalone `Identities` / Identity Lab route, identity catalog API, new
  reset/diagnostics behavior, or session posture aggregation.
- Disabled navigation placeholders, `Coming soon` features, or visually
  present controls without an operational target.
- New workflow semantics, graph node/action types, runner behavior, evidence
  persistence, scheduling rules, IPC commands, or database schemas.
- Mobile phone layouts.

## Existing Product Boundary

The implementation must use current capabilities as its behavioral boundary:

| Area | Current Capability To Preserve |
| --- | --- |
| Workflows | List, create, edit settings, duplicate, import/export, delete, run saved workflow, stop active workflow, and open graph detail. |
| Graph Builder | Edit/save/validate/run graph, run from selected when eligible, inspect node/link issues, and show progress on canvas. |
| Runs | Show current app-session run snapshots and stop a selected active run by run id. |
| Schedules | List, create, edit, enable/disable, delete, and inspect schedule events. |
| Settings | App-level graph autosave and graph shortcut guidance. |
| Workflow Settings | Existing General, Graph, Run Policy, Browser Launch, and Environment controls including identity reset and retained-session rules. |
| Evidence | Existing run outputs/artifact metadata and issue content only; no explorer UI in this spec. |

If a Stitch region requires information or commands outside this table, that
region must be omitted, simplified to working data, or deferred to a later
spec. The implementation must not fabricate completeness through placeholder
UI.

## Information Architecture And Navigation

### Active Navigation

The production shell in this spec exposes only:

| Navigation Label | Current Destination |
| --- | --- |
| Workflows | Workflow list and entry to Graph Builder. |
| Runs | The existing cross-workflow current-session monitor currently named Run Center. |
| Schedules | Existing schedule management and event history page. |
| Settings | Existing app-level settings page. |

The application continues to open into `Workflows`.

### Deferred Navigation

`Overview`, `Evidence`, and `Identities` must not appear in the sidebar,
command bar, or page actions until their corresponding product specifications
have been implemented. This includes disabled items and controls that merely
suggest future navigation.

### Label Migration

The user-facing name `Run Center` changes to `Runs` in navigation, page
heading, accessible page naming, tests, and user-facing documentation. Internal
file/component names such as `RunCenterPage` may remain unchanged if renaming
would add churn without user value.

## Production Design System

Implementation replaces the existing root `DESIGN.md` source of truth with a
Mission Control production design system. The committed Stitch system and
screens are visual references, while the root design system is authoritative
for shipped renderer decisions.

### Visual Character

Mission Control is a dark, precise operations workspace intended for repeated
desktop use. It favors compact readable data, stable panel geometry, explicit
status semantics, visible control affordances, and limited motion.

### Color Roles

| Role | Token Value | Production Usage |
| --- | --- | --- |
| Canvas | `#0B1016` | Main application background. |
| Sidebar / inset | `#0E151D` | Sidebar and deep regions. |
| Surface | `#121C26` | Panels, table areas, graph tooling. |
| Elevated surface | `#172431` | Dialogs, drawers, active detail surfaces. |
| Border | `#233240` | Default separation and controls. |
| Emphasized border | `#314758` | Focused/hovered/selected container boundaries. |
| Primary text | `#E7EEF5` | Titles and essential content. |
| Secondary text | `#9AAEBD` | Supporting labels and descriptions. |
| Muted text | `#667D8D` | Noncritical metadata only. |
| Active/control cyan | `#32D3E6` | Primary action, focus, selection, active run. |
| Cyan wash | `rgba(50, 211, 230, 0.12)` | Selected rows and restrained active emphasis. |
| Success green | `#39D98A` | Successful terminal outcome only. |
| Attention amber | `#F4B740` | Validation, stale/recheck, warnings. |
| Failure red | `#F06467` | Runtime/system failure and destructive actions. |

Green is no longer a general brand or primary-action color. A state must not
be conveyed by color alone; visible text and, where suitable, an icon accompany
semantic colors.

### Typography

- Use `Inter` or the closest locally supported modern sans family for UI.
- Use a monospace family for run ids, timestamps, identity ids, serialized
  details, and technical values.
- Use compact desktop type hierarchy: page titles approximately `28-32px`,
  section headings `18-20px`, controls/body `13-14px`, metadata `11-12px`.
- Letter spacing remains `0`; technical meaning comes from monospace treatment
  and labels rather than tracked uppercase typography.
- Avoid hero-sized promotional typography because every surface in this scope
  is an operational workspace.

### Shape, Density, And Elevation

The production treatment intentionally translates the Stitch concept into
app-appropriate control geometry:

- Use `4px` and `8px` spacing increments for compact operational layouts.
- Use radii of at most `8px` for controls, repeated cards, panels, and table
  regions.
- Dialogs and focused overlay surfaces may use up to `12px` radius.
- Use status pills only for compact semantic indicators; do not convert normal
  commands into oversized pill treatments without a clear primary-action role.
- Use borders and tonal surfaces for normal depth. Shadows are reserved for
  dialogs/popovers where the surface must sit over existing context.
- Do not nest decorative cards inside cards. Page sections are unframed layout
  regions or functional panels; repeated artifacts/list items may be cards.

### Interaction And Accessibility

- Icon-only tools retain accessible labels and hover/focus tooltips.
- Focus indicators use visible cyan treatment against dark surfaces.
- Primary commands use icon plus clear text where the action is consequential,
  including `Launch Run`, `New Workflow`, and schedule creation.
- Active execution may animate only a small indicator; large panels and layout
  regions remain stable.
- Controls, tables, graph surfaces, and dialogs must remain usable by keyboard.

## App Shell Adoption

### Sidebar

The sidebar becomes the consistent Mission Control anchor. It includes:

- A clearly visible Mission Control / product identity area.
- The four active navigation destinations only.
- Existing sidebar collapse behavior presented as an icon rail at compact
  width.
- Operational footer/diagnostic information only when an existing data source
  or action already supports it; otherwise the footer stays minimal.

The sidebar does not render future workspaces or nonfunctional environment,
alert, diagnostics, or operator controls simply because they appear in the
concept suite.

### Page Header / Command Region

Existing pages receive a compact Mission Control command-region treatment with
page context, working statuses, and real primary actions. Global search,
environment selection, alerts, or activity controls are deferred unless an
existing implementation already supports them in the affected page.

### Compact Desktop

The baseline remains a desktop application. At narrower desktop dimensions:

- The sidebar can use its current collapsed/rail behavior.
- Tables preserve primary identity/action columns and may reduce secondary
  metadata through responsive rules.
- Graph tooling preserves canvas working area; palette or inspector regions may
  condense or layer if implementation requires it.
- Dialogs remain bounded to the viewport with scrollable content where needed.

No phone-specific navigation or mobile-first redesign is part of this spec.

## Workspace Adoption

### Workflows

The workflow list becomes the Mission Control workflow-management surface while
retaining all current commands and rules.

Required adoption:

- Mission Control page header, creation/import commands, table/list surfaces,
  state badges, row action treatments, loading/empty/error states, and
  confirmation/package dialogs.
- Active workflow run state and row-level `Stop` remain scoped to the matching
  workflow run.
- Existing create, edit settings, duplicate, import, export, delete, view
  detail, and run commands remain available and keep current eligibility rules.

The selected workflow preview/sidebar from the Stitch concept is optional only
if it can be composed entirely from currently available workflow/run/schedule
data without adding behavior or hiding existing actions. It is not required
for acceptance and must not delay the coherent migration.

### Graph Builder / Workflow Detail

Graph Builder receives the most substantial adoption because it is the core
authoring workspace.

Required adoption:

- Mission Control detail header and command treatments.
- Dark graph canvas, node/palette/inspector/control treatments, status
  semantics, minimap/tooling treatment where those elements currently exist,
  and current live progress presentation.
- Current graph editing, selection, validation, save/autosave, shortcut,
  settings, and `Run from selected` behavior preserved.
- Validation nodes remain amber and runtime failures remain red when selected;
  selection adds cyan emphasis without overwriting the status.
- Full graph runs use the `Launch Run` confirmation described below.
- Issue presentation uses the summary/detail model described below.

### Runs

The existing Run Center page is adopted visually and relabeled `Runs`.

Required adoption:

- Page/navigation/accessibility labels use `Runs`.
- Existing current-session run snapshots remain the data source.
- Existing active run stop command remains available.
- Tables, status labels, errors, empty state, and working controls use Mission
  Control treatment.

The page must not claim persisted run-history exploration, artifact browsing,
or evidence navigation beyond commands actually available during
implementation.

### Schedules

Schedules adopts the new shell, table, event history, dialog, semantic status,
and command presentation while preserving current scheduler behavior.

Required adoption:

- Existing create/edit/enable/disable/delete/history interactions.
- Existing schedule kinds, validation feedback, and latest-saved-workflow
  messaging.
- Semantic handling for enabled/disabled and currently represented event
  outcomes.

No new timeline/calendar data model or trigger semantics are required solely
to match concept composition.

### Settings

Settings adopts Mission Control surfaces for its current app-level settings:

- Graph autosave preference.
- Graph shortcut guidance.

It must not show appearance modes, broad policy configuration, diagnostics
configuration, or environment configuration merely because those appear in the
concept screen. Per-workflow settings continue to live in Workflow Settings.

### Shared Dialogs And Feedback

All visible dialogs and feedback states reached through adopted pages use the
same production component treatment, including:

- Workflow Settings and identity-reset confirmation.
- Workflow create/edit/delete and import/export package surfaces.
- Schedule creation/edit/history/delete interactions.
- Launch confirmation and issue detail overlays.
- Toast, loading, empty, warning, blocked, and error states.

## Graph Builder Interaction Changes

### Full-Run Launch Confirmation

The current primary full-run command is presented as `Launch Run`. Triggering a
full graph run from the workflow detail header or a graph-workspace shortcut
opens a confirmation dialog before invoking the existing full-run
orchestration.

The dialog may display only already loaded/current data:

- Workflow name.
- Current graph save status.
- Workflow identity display name and current session reuse behavior from loaded
  Workflow Settings.
- Relevant current run policy and launch choices already represented in loaded
  settings, such as retention/headless/humanize context where present.
- Any already known caution state, such as unsaved graph/settings work or stale
  validation state, without pretending validation has passed.

Dialog actions:

- `Cancel` returns to Graph Builder without executing.
- `Launch Run` invokes the existing full-run path.

The existing full-run orchestration remains authoritative after confirmation:
it saves visible graph/settings as required, validates before browser launch,
blocks on failures, starts the run only when allowed, and reports failures
through current state.

Every full-run trigger from Graph Builder must respect this confirmation. A
keyboard shortcut must not bypass it.

### Run From Selected

`Run from selected` remains the existing direct workflow-detail command. It is
not renamed to `Launch Run` and does not use the full-run confirmation dialog
in this spec because it is an explicitly enabled retained-session debugging
operation with its own current eligibility gates and scope selection.

Its current safety rules remain unchanged:

- It appears only when enabled in Workflow Settings.
- It requires an eligible selected main-path node.
- It requires compatible retained-session and run-policy settings.
- It saves visible graph/settings according to current behavior.
- It must not silently launch a fresh browser when the retained session is
  stale or unavailable.

### Validation And Failure Detail

Graph Builder keeps a compact issue summary region for blocking validation,
runtime failure, system/startup failure, and stale/recheck information. The
summary must preserve the operator's view of graph context rather than replace
the canvas with a large error screen.

Opening details for an issue displays a focused dialog/overlay backed only by
the current issue sources:

- `GraphValidationIssue` data.
- Current application/command error data.
- Current `RunState.error` data.
- Existing derived issue summaries and suggestions.

The detail view supports only commands that can execute with current
capabilities:

- Expand/show existing raw details where available.
- `Copy details`.
- `Validate again` for validation/recheck states.
- `Run again` for eligible runtime failures.
- `Go to node` or `Go to link` when issue context identifies one.
- Existing save retry behavior for relevant system/startup failures.

When `Run again` initiates a full graph run, it opens the same `Launch Run`
confirmation before invoking the existing run path. It is not an alternate
unconfirmed full-run trigger.

The dialog does not expose `Open Evidence` unless the implementation already
has a working artifact-opening action in this exact interaction path. Evidence
Explorer navigation is deferred to its own specification.

### Stale Issue Preservation

When graph edits occur after validation or failure state was produced, visible
issues remain available and are marked as needing recheck under the current
rules. Restyling or moving details into a dialog must not silently discard
operator-visible issue context.

## Data Flow And Technical Boundary

This is a renderer-focused migration. The intended data flow remains:

```text
App.tsx orchestration and existing API wrappers
  -> existing page/component props and current state
  -> Mission Control shell/pages/dialogs
  -> current IPC commands and backend behavior
```

### Renderer Responsibilities

- Root design tokens, layout styling, responsive behavior, and component
  treatment.
- Navigation label/presentation changes.
- Local dialog state for `Launch Run` and issue detail presentation.
- Wiring confirmed full-run intent back to the existing run callback.
- Rendering current workflow/settings/run/validation/schedule data in the new
  surface language.
- Focused UI tests and interaction regression protection.

### Backend / Contract Responsibilities

No backend, IPC, persistence, scheduling, evidence, run-state, graph
compilation, or runner contract change is designed in this spec.

If implementation proves that an approved interaction cannot work on existing
contracts, work must pause for an explicit amendment or separate approved spec
rather than opportunistically expanding backend behavior.

## Error Handling And UX Rules

- Validation/recheck states use amber semantic treatment and readable labels.
- Runtime and system/startup failures use red semantic treatment and readable
  summaries.
- Active execution uses cyan; successful completion uses green.
- Destructive actions remain confirmed and identify affected scope.
- Full-run confirmation does not imply the run will succeed or validation has
  passed; it is an operator confirmation before the existing pipeline runs.
- Save or validation failures after launch confirmation must leave the operator
  in an actionable Graph Builder context with issue information visible.
- Long raw runner/browser messages remain subordinate by default and available
  through explicit details/copy actions.
- Empty/loading/error states state the current condition and expose only real
  recovery or creation actions.

## Testing And Verification Strategy

Implementation is a user-visible behavior and layout change, so it must use
test-driven development before production code edits and follow the repository
docs/design workflow.

### Focused Automated Coverage

Expected focused tests include:

| Surface | Verification |
| --- | --- |
| Shell/sidebar | Active labels, `Runs` label migration, collapse behavior, accessible nav and absence of future route placeholders. |
| Workflows | Existing actions, active-run row state, Mission Control state presentation, dialogs and empty/error handling. |
| Graph Builder detail | `Launch Run` opens confirmation; cancel does not run; confirm invokes existing full-run path; shortcut cannot bypass confirmation. |
| Graph Builder issues | Issue summary remains visible; detail dialog exposes only valid actions; node/link selection and stale/recheck behavior remain correct. |
| Runs | Renamed page accessible label/title and existing snapshot/stop behavior. |
| Schedules | Existing schedule interactions and event/status rendering after restyling. |
| Settings | Existing autosave/shortcut settings remain operable after adoption. |
| Styling/static checks | Updated token/layout/status/radius invariants where the repo guards CSS/static shell output. |

### Required Check Categories

The implementation plan must choose exact focused test commands based on
touched files. At minimum, completed implementation should include:

- Focused Vitest tests for every changed page/component behavior.
- `npm test -- src/AppCss.test.ts` when CSS invariants change.
- `npx tsc --noEmit`.
- `npm test`.
- `npm run build`.

### Visual Verification

Because this is a full styling/layout migration, implementation must perform
browser or Electron visual review at:

- Desktop baseline corresponding to the Mission Control reference layout.
- Compact desktop where the sidebar collapses and dense surfaces still work.

The review must cover at least shell navigation, workflow management, Graph
Builder with each new overlay, Runs, Schedules, Settings, and dialogs. It must
confirm no blank views, overlapped controls, clipped dialog actions, unreadable
text, or missing working controls.

## Documentation Updates During Implementation

This design document is planning history. It does not by itself change current
production truth.

When implementation proceeds, it must update current source-of-truth
documentation where the shipped behavior has changed:

| Documentation | Required Change Trigger |
| --- | --- |
| `DESIGN.md` | Always update for production Mission Control adoption. |
| `docs/architecture/frontend.md` | Shell ownership, page presentation, new dialogs, or naming changes. |
| `docs/domain/user-visible-invariants.md` | `Runs` label, full-run confirmation, and issue detail behavior. |
| `docs/domain/workflow-lifecycle.md` | Full-run interaction changes if the user flow is documented there. |
| `README.md` | Smoke checklist labels or required run/validation interaction steps change. |
| Contract/backend docs | Only if a separately approved implementation change alters actual contracts or runtime behavior. |

## Implementation Constraints

- Read current docs route and root `DESIGN.md` before implementation edits.
- Use TDD for the behavior changes described in this spec.
- Prefer existing shared UI primitives and existing page/component ownership.
- Keep edits scoped to shipped surfaces in this spec; no future workspace
  stubs.
- Do not revert unrelated changes already present in the branch/worktree.
- Preserve the authorized-testing product boundary and existing auditability
  requirements.

## Acceptance Criteria

This specification is successfully implemented when:

- Root production `DESIGN.md` defines Mission Control rather than the prior
  Supabase-inspired production direction.
- `Workflows`, workflow detail / Graph Builder, `Runs`, `Schedules`, and
  `Settings` render as one coherent Mission Control desktop application.
- Existing dialogs and feedback surfaces reached from those workspaces use the
  same visual and interaction system.
- The app opens at `Workflows`, and sidebar navigation exposes exactly the
  currently implemented workspaces in this phase.
- User-facing `Run Center` is renamed to `Runs` without changing current run
  monitoring semantics.
- There are no visible placeholders or nonfunctional controls for `Overview`,
  `Evidence`, or `Identities`.
- Full graph-run triggers in Graph Builder present `Launch Run` confirmation
  before the existing run orchestration executes.
- `Run from selected` keeps current direct retained-session behavior and its
  eligibility rules.
- Validation/runtime/system issue details use a focused, actionable
  Mission Control interaction while preserving current issue data,
  stale/recheck behavior, and node/link navigation.
- No IPC, persistence, graph, schedule, runner, evidence, or identity-domain
  behavior has been expanded solely to complete this UI migration.
- Focused tests, typecheck, full tests/build, and desktop/compact visual review
  pass for the implemented surface.
- Current source-of-truth docs accurately describe the shipped UI after
  implementation.

## Next Specifications

Before implementation planning starts, the remaining design cycles must define
and receive user approval for `Operations Overview`, `Evidence Explorer`,
`Identity Lab`, and `Cross-Workspace Traceability And Polish`. Once the full
specification set is approved, implementation planning can sequence these
bounded changes and reconcile the complete production experience with the
original Stitch suite.
