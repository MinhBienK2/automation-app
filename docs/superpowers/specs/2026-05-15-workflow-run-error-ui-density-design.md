# Workflow Run Error UI Density Design

## Context

The workflow detail screen currently exposes run failures in three places: the page header status, the `RunIssuePanel`, and the selected-node inspector. In the failure state shown in the screenshots, the information is technically present but the layout feels heavy and brittle:

- The top-right workflow actions render as full-width grid buttons, creating a large command block that competes with the title and status.
- Runtime error text is repeated in the header status, issue panel, and inspector.
- Long Playwright/browser errors can overflow narrow panels, especially the right inspector.
- The run issue panel occupies a large vertical band before the graph, pushing the actual failed node farther away.
- The inspector does not visually separate node identity, connection metadata, failure details, and editable configuration strongly enough.

This spec covers a UI-only redesign. It does not change runner behavior, run-state payloads, validation semantics, or graph persistence.

## Goals

- Make the workflow detail failure state readable without visually breaking the page.
- Keep the graph and failed node visible as the primary repair surface.
- Reduce header action footprint while preserving all existing commands.
- Preserve the Supabase-inspired dark theme from `DESIGN.md`.
- Keep all long error strings contained inside their panel at desktop and mobile widths.
- Avoid hiding critical failure information behind a route change or separate screen.

## Non-Goals

- No changes to `RunState`, Electron IPC contracts, runner errors, or graph validation logic.
- No new run history viewer.
- No changes to action config fields or workflow settings behavior.
- No visual theme replacement.

## Design Principles

- Header actions are commands, not content. They should be compact, stable, and secondary to workflow identity and run status.
- The issue panel should summarize first, then provide details on demand.
- The inspector should show selected-node context and repair controls, not duplicate the full issue panel.
- Error text must wrap or scroll inside its own container; it must never force the panel wider than its column.
- Semantic colors remain unchanged: red for runtime failure, amber for validation issues, cyan/blue for selection or active execution, and green for success/completion.

## Recommended Approach

Use a compact command bar in the header, a condensed run issue panel with expandable/copyable details, and a constrained inspector failure card.

This is preferred over only changing CSS because the current problem is partly information architecture: the same long failure is repeated at multiple levels with no hierarchy. It is also preferred over moving failures into a modal because operators need to see the graph while fixing the failed node.

## Alternatives Considered

1. CSS-only containment fix.
   - Pros: smallest change.
   - Cons: leaves duplicated error surfaces and oversized header actions.

2. Modal-only error detail.
   - Pros: clean main screen.
   - Cons: separates the diagnostic from the graph and selected-node controls.

3. Recommended: compact summary plus local expandable details.
   - Pros: keeps context on the page, reduces visual weight, and fixes overflow.
   - Cons: requires small component changes in addition to CSS.

## Header Action Redesign

### Current Problem

`WorkflowDetailPage` renders `Settings`, `Validate`, `Run`, optional `Run from selected`, `Save`, and optional `Stop` as normal text buttons inside `.run-actions`. On desktop this becomes a 4 or 5 column grid with a width up to 680px. On narrower layouts each button becomes a full-width row.

### Target Behavior

Replace the grid-like header controls with a compact command bar:

- `Run` remains the primary visible text button.
- `Stop` appears as a destructive visible text button only while running.
- `Run from selected` remains visible text when enabled because its disabled reason is important.
- `Settings`, `Validate`, and `Save` become icon buttons with accessible labels and tooltips.
- The command bar uses one horizontal row on desktop and wraps compactly when needed.
- Buttons use `size="sm"` or icon sizing instead of default `h-10 px-4` controls.
- The header meta `Saved/Unsaved/Saving` remains separate from actions.

Suggested command order:

1. Settings icon
2. Validate icon
3. Save icon
4. Run from selected, only when feature is visible
5. Run
6. Stop, only while running

### Acceptance Criteria

- At 1920px width, header actions occupy less than 360px in the normal non-running state.
- At 1366px width, actions do not wrap into a tall block unless `Run from selected` and `Stop` are both visible.
- At 860px and below, controls wrap in compact rows rather than full-width stacked buttons unless the viewport is too narrow for two controls.
- Every icon-only action has an accessible label and tooltip.
- `Run` remains visually primary.

## Run Issue Panel Redesign

### Current Problem

`RunIssuePanel` renders a large panel with the full runtime error message and suggestions. Runtime failures often include long URLs, protocol names, escaped control codes, and Playwright call logs. The panel becomes visually dominant and repeats content already shown in the selected-node inspector.

### Target Structure

Use a compact, two-level issue panel:

- Header row:
  - Severity badge.
  - Short title, for example `Run failed at step 1: Navigate`.
  - One-line normalized reason, clamped to two lines.
  - Actions: `Run again`, `Select failed node`, and `Copy details` when a runtime issue has details.
- Detail area:
  - Collapsed by default for runtime/system errors when a selected graph issue exists.
  - Expandable inline area labeled `Details`.
  - Monospace, wrapped, max-height constrained, scrollable.
  - Uses `overflow-wrap: anywhere` and `white-space: pre-wrap`.
- Suggestions:
  - Keep at most 3 high-signal suggestions visible.
  - Use compact rows, not a large nested block.

### Runtime Error Text Rules

- Split the display into:
  - `summary`: human-sized reason shown in the main row.
  - `details`: raw error/call log shown in the expandable block.
- Do not duplicate the exact raw error in both the panel body and inspector.
- Preserve original raw text for copy/debugging.
- Do not strip URLs or error codes.

### Acceptance Criteria

- A long `page.goto` failure with URL and call log stays inside the panel at 320px, 860px, 1366px, and 1920px widths.
- The panel should not exceed roughly 180px tall in its collapsed runtime-failure state on desktop.
- `Select failed node` remains available from the issue panel.
- `Needs recheck` behavior remains visible after graph edits.
- Blocking validation issues can still show multiple issue cards, but each card must wrap safely.

## Inspector Redesign

### Current Problem

The right inspector is narrow. In the screenshot, the runtime error overflows horizontally and pushes against the app edge. The inspector also stacks connection data, run error, config fields, focus, and delete controls without enough hierarchy.

### Target Structure

The inspector should be a constrained, scrollable side panel with clear sections:

1. Node header
   - Node label and node type.
   - Help button remains compact.
2. Status card, only when selected node has validation/run state.
   - Runtime failure badge or validation badge.
   - Short failure summary.
   - `View details` disclosure and `Copy details` action when raw error exists.
3. Connections card
   - Incoming/outgoing links as compact chips or rows.
4. Port guidance and validation issues, when present.
5. Configuration fields.
6. Footer actions
   - `Focus` and `Delete Node` pinned visually at the bottom when space allows, otherwise normal flow.

### Inspector Containment Rules

- `.graph-inspector` must have `min-width: 0`.
- Long text containers must set `overflow-wrap: anywhere`.
- Raw error blocks use monospace, `white-space: pre-wrap`, and max height.
- The inspector column should remain around 300px on desktop but may increase to 320px if needed.
- On mobile, the inspector stacks below the canvas and uses full available width.

### Acceptance Criteria

- The `Last run error` content shown in the screenshot does not overflow the inspector at 300px width.
- The URL remains readable through wrapping.
- Configuration fields remain usable after an error card appears.
- `Focus` and `Delete Node` remain reachable without horizontal scrolling.

## Graph Workspace Layout

The run issue panel should not permanently push the graph out of view. When a runtime failure exists:

- Keep the issue panel above the graph, but make the collapsed state compact.
- Preserve selected failed-node highlighting on the canvas.
- `Select failed node` should scroll/focus the graph node without requiring the operator to manually search.
- The graph toolbar remains unchanged except for any incidental spacing needed to align with the denser header.

## Component Scope

Expected files for implementation:

- `src/features/workflows/pages/WorkflowDetailPage.tsx`
- `src/features/workflows/components/RunIssuePanel.tsx`
- `src/features/workflows/components/WorkflowGraphInspector.tsx`
- `src/components/ui/icon-button.tsx` only if the existing primitive cannot support the needed tooltip/size behavior
- `src/styles/workflows.css`
- `src/styles/workflow-graph.css`
- `src/styles/layout.css`
- `src/styles/responsive.css`
- Focused tests near `WorkflowDetailPage.test.tsx` and `WorkflowGraphEditor.test.tsx`
- `src/AppCss.test.ts` if CSS invariant coverage is added or changed

## Testing Plan

- Add or update component tests for:
  - Header renders compact icon-only Settings/Validate/Save actions with accessible names.
  - `Run` remains enabled/disabled according to existing `isRunning` behavior.
  - Runtime issue panel renders a short summary and a details disclosure/copy control.
  - `Select failed node` still calls the existing node-selection callback.
  - Inspector renders long run errors without duplicating the full issue panel structure.
- Run focused tests:
  - `npm test -- src/features/workflows/pages/WorkflowDetailPage.test.tsx`
  - `npm test -- src/features/workflows/components/WorkflowGraphEditor.test.tsx`
  - `npm test -- src/AppCss.test.ts` if CSS invariants are touched
  - `npx tsc --noEmit`

## Documentation Impact

This implementation should update docs only if the behavior wording changes. Likely docs to check:

- `docs/architecture/frontend.md`
- `docs/domain/user-visible-invariants.md`
- `docs/contracts/run-state.md`

If the implementation only changes presentation density and text containment while preserving existing issue visibility, run-state semantics, and commands, docs updates may not be required beyond this spec.

## Risks

- Over-compressing controls could make important actions harder to discover. Tooltips and accessible names are required for icon-only actions.
- Hiding raw errors too aggressively could slow debugging. The raw details must remain available inline and copyable.
- Mobile wrapping can regress if compact controls still assume desktop widths. Responsive checks must include narrow viewports.

## Self-Review

- No runtime contracts change.
- No runner or backend behavior is required.
- The spec names concrete components, CSS files, and acceptance criteria.
- Long-error containment is explicit for both issue panel and inspector.
- The header button density requirement is measurable.
