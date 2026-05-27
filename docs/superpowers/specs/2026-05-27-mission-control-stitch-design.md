# Mission Control Stitch UI Suite Design

Date: 2026-05-27

## Status

Design direction approved for a written spec on 2026-05-27.

This spec is ready for user review before any Stitch design system or screen
generation work begins.

## Goal

Design a complete desktop UI concept suite in Stitch for Workflow Automation
Manager. The suite reframes the app as a mission-control workspace for building
automation workflows, observing live execution, reviewing evidence, scheduling
runs, and understanding browser identities.

The design is concept-first. It may introduce navigation and surfaces beyond
the currently implemented application when they improve the operating model.
Any later implementation must explicitly select which concepts become product
behavior and update current source-of-truth docs and `DESIGN.md` accordingly.

## Context And Existing Constraints

The current repository is an Electron desktop workflow automation app with:

- A sidebar-based shell.
- Workflow list and graph-focused workflow detail screens.
- Run Center, Schedules, Settings, and per-workflow settings.
- Browser identity and execution evidence concepts already represented in the
  domain.

The repository currently defines a Supabase-inspired dark visual system in
`DESIGN.md`. An existing Stitch project, `Automation App Design`, includes a
separate blue/slate `Precision Automation System` design system and logo
screens. Neither existing visual direction is the chosen target for this
concept suite.

The approved direction introduces a new `Mission Control` identity. This spec
does not immediately replace `DESIGN.md`, because no production UI behavior or
styling is being changed in this design-only phase.

## Chosen Product Direction

### Experience Architecture

Use **Operations Hub + Specialized Workspaces**.

The first screen is an operations dashboard that summarizes live runs,
attention items, scheduled work, and evidence. Dedicated workspaces then handle
authoring, monitoring, investigation, scheduling, identity posture, and system
configuration.

This direction was selected over:

| Alternative | Reason Not Chosen |
| --- | --- |
| Graph-Centric Command Center | Makes authoring efficient but overloads one workspace with cross-run operational information. |
| Incident / Run-Centric Console | Serves investigation well but weakens workflow authoring as a core product capability. |

### Visual Personality

Use **Mission Control**: a dark, precise, real-time operations workspace with
strong information hierarchy and disciplined semantic signaling.

Approved characteristics:

- Balanced density, suitable for long desktop sessions.
- Cyan for selection, control, and active execution.
- Green reserved for successful completion.
- Amber for validation and attention states.
- Red for failures and destructive actions.
- Technical metadata presented compactly in monospace.
- Desktop-first layouts with a deliberate narrow-window adaptation.

## Information Architecture

The desktop navigation includes:

| Navigation Item | Purpose |
| --- | --- |
| Overview | Operations dashboard and the default entry point. |
| Workflows | Workflow library and entry into Graph Builder. |
| Runs | Active and historical execution monitoring. |
| Evidence | Artifacts, screenshots, observations, and technical run evidence. |
| Schedules | Upcoming, paused, skipped, and failed scheduled activity. |
| Identities | Browser personas, session continuity, posture, and related run health. |
| Settings | Application preferences, policy and diagnostics. |

`Evidence` and `Identities` are concept expansions. They build on concepts
already present in the current product domain, but they are not commitments
that these complete standalone workspaces currently exist in code.

## Design System

### Palette

| Role | Value | Usage |
| --- | --- | --- |
| App background | `#0B1016` | Main desktop canvas. |
| Deep panel / sidebar | `#0E151D` | Sidebar and inset workspace regions. |
| Surface | `#121C26` | Cards, lists, graph panels. |
| Elevated surface | `#172431` | Selected detail panels, overlays and drawers. |
| Standard border | `#233240` | Card and control boundaries. |
| Emphasized border | `#314758` | Hover, active container separation. |
| Primary text | `#E7EEF5` | Headings and core content. |
| Secondary text | `#9AAEBD` | Supporting descriptions and data labels. |
| Muted text | `#667D8D` | Metadata and disabled labels only. |
| Active/control cyan | `#32D3E6` | Focus, selection, active run and primary actions. |
| Cyan wash | `rgba(50, 211, 230, 0.12)` | Selected table rows and soft emphasis. |
| Success green | `#39D98A` | Completed execution only. |
| Validation amber | `#F4B740` | Warning and validation attention. |
| Failure red | `#F06467` | Failure, blocking errors and danger actions. |

Color is never the sole indicator of state. Semantic states also include an
icon and readable status label.

### Typography

- Primary UI family: `Inter`, or the closest modern sans available in Stitch.
- Technical family: `Geist Mono`, or equivalent monospace for run IDs,
  timestamps, policy tags, node details, and evidence metadata.
- Page title: `28-32px`, weight `600`.
- Section title: `18-20px`, weight `500`.
- Body and standard controls: `13-14px`, weight `400-500`.
- Technical label: `11-12px`, uppercase with expanded letter spacing.
- Metric value: `28-36px`, weight `600`, used sparingly.

### Shape And Spacing

- Use a `4px` / `8px` spacing rhythm.
- Use `8px` radius for form controls and compact controls.
- Use `12px` radius for cards and data panels.
- Use `16px` radius for large panels, drawers, and dialogs.
- Use full pills for status chips and compact filters.
- Use subtle tonal separation and borders for normal depth.
- Reserve restrained soft shadow for dialogs, menus, and drawers.

## App Shell

### Desktop Baseline

The primary design frame is `1440 x 1024`.

The shell includes:

- A left sidebar, approximately `232px` wide, containing product mark,
  navigation, environment state, diagnostics indicator, and operator area.
- A top command bar in the main region containing page context, command/search
  entry, environment badge, alerts shortcut, and page-specific primary action.
- A content canvas composed of bordered panels and cards at balanced density.

### Narrow Desktop Window

The required compact frame is `1024 x 768`.

At this size:

- Sidebar collapses into an icon rail.
- Dashboard content reduces to two columns or a prioritized stack.
- Metadata columns in dense tables are hidden before primary content.
- The Graph Builder inspector opens as a drawer rather than a persistent third
  column.
- The node palette becomes a drawer or popover.
- No phone/mobile layout is required in this suite.

## Screen Suite

### 1. Operations Dashboard

The default entry point is a working operations board rather than a marketing
landing page.

Required regions:

- Header with page title, last refreshed timestamp, environment filter, and
  `Launch Run` primary action.
- KPI row for `Active Runs`, `Succeeded Today`, `Attention Needed`, and
  `Upcoming Schedules`.
- `Live Operations` panel listing running workflow, identity, current step,
  elapsed time, and current status.
- `Attention Queue` for validation failures, execution failures, identity
  warnings, challenge observations, and failed schedules.
- `Execution Activity` chart or timeline.
- `Recent Evidence` artifact preview cards.
- `Upcoming Schedules` list.

### 2. Workflow Library

This workspace handles discovery and management before opening authoring.

Required regions:

- Search, status/tag/owner/environment filters, and `New Workflow` action.
- Main workflow table with workflow name, last run, health, active schedule,
  identity, and update context.
- Selected-workflow preview panel with recent runs, schedule, identity and
  shortcut actions.
- Empty state showing the first creation action.
- Secondary actions for duplicate, import, export and archive/delete.

### 3. Graph Builder

This is the main authoring workspace.

Required regions:

- Header containing workflow name, save status, environment, `Validate`, and
  `Launch Run`.
- Collapsible left palette for actions, logic, variables, and evidence-related
  nodes.
- Central dot-grid canvas with graph nodes, connections, zoom controls and a
  minimap.
- Right inspector tabs: `Configure`, `Help`, and `Run Output`.
- Bottom live execution rail that appears during a run with current step,
  elapsed time, issues and captured evidence.

Graph node semantics:

- Cyan outline/ring: selected or actively executing.
- Green status: completed successfully.
- Amber status: validation issue or warning.
- Red status: failed or blocking.
- A selected amber/red node retains the problem state and gains only a
  secondary cyan selection indication.

### 4. Run Center

This workspace supports execution monitoring across workflows.

Required regions:

- Tabs for `Active`, `Completed`, and `Failed`.
- Filters for workflow, identity, environment, and time range.
- Run list and selected-run detail split layout.
- Selected run timeline with step status, duration, artifact markers and error
  or observation summaries.
- Controls such as `Stop` for active work and `Open Evidence` for recorded
  outputs.

### 5. Evidence Explorer

This concept workspace exposes artifacts and traceability.

Required regions:

- Artifact grid or compact list for screenshots, downloads, logs, browser
  identity reports, and challenge observations.
- Filters for artifact type, status and timestamp.
- Preview/details panel showing the artifact and its workflow, run, identity
  and step relationship.
- Direct navigation back to the related run or workflow.

### 6. Schedules

Required regions:

- Schedule timeline or calendar summary.
- Upcoming and historical schedule list.
- Status treatments for upcoming, paused, skipped and failed triggers.
- Create/edit experience through a drawer or dialog.

### 7. Identity Lab

This concept workspace provides browser identity and session awareness.

Required regions:

- Identity/persona list with session state, environment/network posture and
  recent run health.
- Selected identity detail drawer or panel.
- Evidence links, continuity state, diagnostics and explicit reset controls.

### 8. Settings

Required regions:

- Local settings navigation.
- Application preferences.
- Policy controls.
- Diagnostics and environment configuration.
- Appearance/design mode where useful for concept completeness.

### 9. Graph Builder With Launch Run Overlay

This state demonstrates a high-value action without leaving authoring context.

The overlay summarizes:

- Selected workflow and environment.
- Chosen identity/session behavior.
- Relevant run policy.
- Primary `Launch Run` action and a clear cancellation path.

### 10. Graph Builder With Validation Or Failure Detail Overlay

This state demonstrates operational feedback and return-to-fix behavior.

The overlay includes:

- Error or validation summary.
- Node/step relationship.
- Technical details collapsed or visually subordinate by default.
- Evidence preview when relevant.
- Action returning the operator to the affected graph node.

## Component System

| Component | Treatment And Role |
| --- | --- |
| Primary Button | Cyan fill with dark text; reserved for creation, launch and save. |
| Secondary Button | Dark surface with emphasized border; configure, validate and export. |
| Danger Button | Red-tinted fill or border; stop, delete and reset actions. |
| Status Chip | Compact pill with icon and semantic label. |
| Metric Card | Large number, concise label and optional trend/status marker. |
| Data Table | Sticky header where useful; subtle hover; cyan selected-row wash and indicator. |
| Side Inspector | Tabbed panel with collapsible sections and compact technical fields. |
| Node Card | Action header, concise configuration summary, ports and semantic run state. |
| Timeline Item | Dot, connector, timestamp, summary, and artifact/failure marker. |
| Alert Item | Severity, short message, relevant workflow/run and resolution action. |
| Form Control | Dark surface, explicit border, cyan visible focus, red text-supported errors. |
| Dialog | Used for consequential decisions and focused workflows. |
| Drawer | Used for fast details/configuration that should preserve page context. |

## Interaction And Accessibility Rules

- Running state uses cyan and at most a restrained pulse on a dot or indicator;
  entire panels do not animate.
- Success green appears only for finished successful states.
- Validation uses amber; blocking or runtime failure uses red.
- Loading states use restrained skeletons; empty states include a clear next
  action.
- Destructive actions require confirmation and state the affected scope.
- Evidence items retain traceability to workflow, run, step and identity when
  applicable.
- Every icon-only control has an accessible label and visible hover/focus help.
- Keyboard navigation and clearly visible focus treatment apply to navigation,
  data rows, graph controls and dialog controls.
- Text and essential metadata maintain sufficient contrast against dark
  surfaces; muted text is not used for critical information.

## Stitch Execution Scope

After this spec is approved for execution, Stitch work should:

1. Create or update a new Mission Control design system for the selected
   desktop project, rather than extending the currently conflicting blue/slate
   system without revision.
2. Generate the ten approved desktop screens/states.
3. Keep the `1440 x 1024` layout as the primary target and represent compact
   `1024 x 768` behavior in prompts and/or selected variants.
4. Maintain consistent navigation, typography, status semantics and component
   treatments across every generated screen.

The existing Stitch project can be reused if it supports a desktop screen set
cleanly; its current mobile project metadata and logo-only screens must not
drive layout decisions for the new suite.

## Non-Goals

This design phase does not:

- Modify React, Electron backend, IPC, persistence or runtime behavior.
- Commit to implementing new dashboard, evidence or identity capabilities in
  production code.
- Update `DESIGN.md` before the Mission Control concept has been reviewed as a
  generated UI suite and selected for production adoption.
- Design a mobile application layout.
- Change existing security or authorized-testing product scope.

## Acceptance Criteria For Stitch Suite

The design suite is successful when:

- Ten approved desktop screens/states exist in Stitch.
- Screens visibly belong to one Mission Control design system.
- Overview makes live operations and attention items immediately scannable.
- Workflow authoring remains a first-class deep workspace through Graph
  Builder.
- Active, completed, warning and failed states cannot be confused.
- Run and evidence concepts retain clear traceability across screens.
- Desktop and narrow-window behavior are addressed without compromising the
  graph workspace.
- Any production implementation decision can identify which concepts are
  already supported and which require product/code changes.
