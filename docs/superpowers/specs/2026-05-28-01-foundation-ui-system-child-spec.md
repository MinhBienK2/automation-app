# Mission Control UI/UX Upgrade Child Spec 01: Foundation UI System

Date: 2026-05-28

## Status

Approved design direction, drafted for user review.

This child spec is the first implementation slice under:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`

This spec defines the shared UI foundation that later child specs must build on.
It is intentionally aggressive about architecture and organization, but it must
not become a full product rewrite.

## Goal

Create a durable, AI-agent-friendly UI foundation for Mission Control.

The foundation must:

1. Organize shared UI code into clear layers.
2. Establish a hybrid staged Tailwind/shadcn design-system strategy.
3. Add reusable product patterns so feature pages stop inventing one-off layout.
4. Migrate App Shell, Page Header/Command Region, and a focused slice of
   Overview as reference implementation.
5. Preserve product behavior, routing, IPC boundaries, and workflow semantics.

This spec optimizes for future coding agents. Agents should be able to find the
right file, use a typed primitive or pattern, and avoid scanning unrelated
feature CSS before making a UI change.

## Relationship To Master Spec

This child spec implements the foundation required by the master spec before
feature-specific flows are redesigned.

It supports all 14 master-spec groups, but it directly owns:

- Shared design system application.
- App shell/page geometry foundation.
- Reusable component and pattern inventory.
- Empty/loading/error/warning/disabled state pattern foundation.
- Responsive desktop foundation.
- Accessibility/focus foundation.
- Security/sanitization display primitives.

Feature-specific behavior remains for later child specs.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/architecture/frontend.md`
5. `docs/domain/user-visible-invariants.md`
6. The master spec named above.

### Visual Baseline

Use these Stitch artifacts as visual references:

- App Shell:
  `.stitch/designs/2026-05-28-12-polished-11-app-shell-command-bar.html`
- Overview:
  `.stitch/designs/2026-05-28-12-polished-02-overview.html`
- Dialog and modal treatment:
  `.stitch/designs/2026-05-28-12-polished-12-workflow-settings-dialog.html`
  and `.stitch/designs/2026-05-28-12-polished-10-recording-review-modal.html`

The Stitch screens are not behavior truth. They define visual density,
hierarchy, component treatment, panel geometry, and compact operations-console
feel.

### Current Source Areas

Likely touched:

- `src/components/ui/`
- `src/components/layout/`
- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/features/overview/pages/OperationsOverviewPage.tsx`
- `src/App.tsx`
- `src/App.css`
- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/modals.css`
- `src/styles/responsive.css`

May add:

- `src/components/patterns/`
- `src/styles/tokens.css`
- `src/styles/components.css`

Avoid touching unless clearly required by reference migration:

- `electron/`
- `src/lib/workflowApi.ts`
- `src/types/electron.ts`
- `src/types/workflow.ts`
- Feature-specific workflow graph internals.

## Architecture Direction

Use a hybrid staged design-system architecture optimized for AI agents.

### Target Folder Ownership

```text
src/components/
  ui/
    button.tsx
    icon-button.tsx
    badge.tsx
    dialog.tsx
    input.tsx
    select.tsx
    textarea.tsx
    switch.tsx
    segmented-control.tsx
    tooltip.tsx
    scroll-area.tsx
    label.tsx
    ...

  layout/
    PageFrame.tsx
    PageHeader.tsx
    WorkspaceLayout.tsx
    ...

  patterns/
    CommandRegion.tsx
    StatePanel.tsx
    StatusCluster.tsx
    DataToolbar.tsx
    TableShell.tsx
    DetailPanel.tsx
    KeyValueList.tsx
    ErrorDetails.tsx
    ConfirmActionDialog.tsx
    EmptyState.tsx
```

Existing `src/layouts/AppShell.tsx` and `src/layouts/AppSidebar.tsx` may remain
in `src/layouts/` because they are app-level shell containers already documented
there. New reusable page-level layout components should live under
`src/components/layout/`.

### Ownership Rules

- `components/ui` owns atomic primitives only. It must not know workflow, run,
  evidence, identity, schedule, or settings DTOs.
- `components/layout` owns shell/page/workspace structure. It may know layout
  language such as page title, command region, scroll region, and sidebar
  geometry, but not backend data.
- `components/patterns` owns reusable Mission Control product patterns. Patterns
  may know generic product UI concepts such as status, empty state, detail
  section, key-value metadata, and destructive confirmation. Patterns must not
  call IPC/backend.
- Feature pages own domain data mapping and event handlers. They compose
  primitives and patterns instead of inventing one-off UI systems.
- If a UI structure appears in three or more places, extract it into
  `components/patterns`.
- Do not create duplicate components with the same purpose. Refactor existing
  primitives when possible.

## Styling Strategy

### Strategic Choice

Use **Hybrid staged Tailwind/shadcn**:

- Primitives and patterns use Tailwind utilities, `cva`, `tailwind-merge`, and
  Radix/shadcn-style composition.
- Tokens, document baseline, shell geometry, responsive constraints, and complex
  graph/canvas styling remain centralized in CSS files.
- Feature pages should become thinner composition layers over time.

This is the preferred architecture for AI agents because it creates clear
boundaries without scattering all design logic into long feature-level
`className` strings.

### CSS File Ownership

```text
src/styles/
  tokens.css
  base.css
  layout.css
  components.css
  modals.css
  responsive.css
  workflows.css
  workflow-graph.css
  schedules.css
```

#### `tokens.css`

Owns CSS variables only:

- Canvas/background.
- Sidebar/inset.
- Surface and elevated surface.
- Borders.
- Primary, secondary, muted text.
- Cyan active/focus/primary.
- Green success.
- Amber attention.
- Red failure/destructive.
- Focus rings.
- Radius aliases.
- Spacing aliases where useful.
- Z-index aliases where useful.

It must not define layout classes.

#### `base.css`

Owns:

- Root/body reset.
- Font family.
- Color scheme.
- Base typography defaults.
- Native element fallback only.

It must not use broad global selectors like `button { ... }` to override shared
button primitives in a way that makes component variants unreliable. Native
button/input/select/textarea styles may exist only as conservative fallbacks
for un-migrated code.

#### `layout.css`

Owns:

- App shell geometry.
- Sidebar/page frame.
- Workspace grids.
- Split-panel structures.
- Main scroll regions.
- Stable min/max sizes.

It must not contain feature-specific table, graph, run, evidence, identity, or
schedule styling unless the class is genuinely shared layout.

#### `components.css`

Owns shared CSS hooks that cannot be represented cleanly in a primitive or
pattern class.

Keep this file small. It is not a dumping ground for feature styling.

#### `modals.css`

Owns:

- Dialog viewport constraints.
- Overlay helpers.
- Sticky modal header/footer helpers.
- Scrollable body helpers.
- Popover max-height/overflow constraints.

The canonical dialog anatomy still belongs in `components/ui/dialog.tsx`.

#### `responsive.css`

Owns compact desktop behavior:

- `1024x768` support.
- Sidebar collapse or icon rail.
- Page-level no-horizontal-overflow rules.
- Table/detail responsive behavior.
- Dialog max-height and body scroll.
- Secondary metadata hiding rules.

#### Feature CSS Files

- `workflow-graph.css` keeps graph/canvas-specific styling.
- `workflows.css` and `schedules.css` keep only residual feature styles that
  cannot yet be migrated to patterns.
- When a pattern replaces feature CSS, remove the obsolete feature CSS.

### Utility Class Rules

- Use Tailwind utilities inside primitives and patterns.
- Use `cva` for variant, size, shape, and tone APIs.
- Use `cn`/`tailwind-merge` for caller extension.
- Do not hard-code hex colors in JSX.
- Prefer CSS variables in Tailwind arbitrary values:
  `bg-[var(--app-surface)]`, `border-[var(--app-border)]`.
- Feature pages must not repeat long class strings. If the same class group is
  repeated three times, extract a primitive, pattern, or `cva` variant.

## Required UI Primitives

### `Button`

Current button primitive may be refactored.

Required API:

- Variants:
  - `primary`
  - `secondary`
  - `ghost`
  - `destructive`
  - `quiet`
- Sizes:
  - `sm`
  - `md`
  - `lg`
  - `icon`
- Optional `asChild` support may remain.

Behavior:

- Primary is reserved for the primary command in a region or dialog.
- Destructive uses red text/border treatment, not a filled alarming block unless
  the design system later explicitly requires it.
- Disabled state preserves geometry and reduces emphasis.
- Focus-visible state uses cyan ring/border.
- Radius follows `DESIGN.md`; no pill default.

### `IconButton`

Required API:

- Requires accessible label.
- Requires tooltip text unless the visible context already names the control.
- Supports tone/variant for neutral, primary, warning, destructive.
- Supports stable sizes for toolbar, row action, compact command.

Behavior:

- Must not resize based on tooltip or icon.
- Must use lucide icons where available.
- Must expose hover/focus tooltip.

### `Badge` And `StatusBadge`

Either extend existing `badge.tsx` or add a `StatusBadge` if separation is
clearer.

Required tones:

- `neutral`
- `muted`
- `active`
- `success`
- `warning`
- `danger`

Behavior:

- Uses semantic color plus readable text.
- Never communicates state by color alone.
- Supports compact size for dense tables.
- Supports optional dot/icon only when it does not add clutter.

### `Dialog`

Current Radix dialog primitive may be refactored.

Required anatomy:

- Overlay.
- Content.
- Header.
- Title.
- Description.
- Body.
- Footer.
- Close control.

Required size variants:

- `sm`
- `md`
- `lg`
- `xl`
- `fullscreen-ish` for dense app workflows without becoming true fullscreen.

Behavior:

- Fits inside `1024x768`.
- Body scrolls independently when content exceeds viewport.
- Header/footer may be sticky for dense dialogs.
- Close button has accessible label.
- Focus-visible treatment follows tokens.

### Form Primitives

Primitives:

- `Input`
- `Select`
- `Textarea`
- `Switch`
- `SegmentedControl`
- `Label`

Required states:

- default
- hover where applicable
- focus-visible
- disabled
- invalid/error
- help/description association

Behavior:

- Use shared tokens.
- Keep labels and help text readable at dense desktop scale.
- Do not rely on browser-native inconsistent styling.

### `Tooltip`

Required behavior:

- Used for icon-only controls and compact tool actions.
- Hover and focus support.
- Delay is acceptable but must not hide critical help or errors.
- Not used as the only explanation for disabled consequential actions. Disabled
  actions must have nearby visible reason when the consequence is important.

## Required Product Patterns

### `CommandRegion`

Purpose:

Standard command area for page/workspace headers and dense panel headers.

Slots/props:

- Title.
- Optional eyebrow/context.
- Optional description.
- Optional `StatusCluster`.
- Primary action.
- Secondary actions.
- Utility actions.
- Optional search/filter slot for compact pages.

Rules:

- One visually dominant primary action at most.
- Secondary actions are visually lower emphasis.
- Utility actions can be icon-only with tooltip.
- Must wrap predictably at compact width.

### `StatusCluster`

Purpose:

Group small statuses without creating visual noise.

Use for:

- Run state.
- Save state.
- Validation state.
- Identity posture.
- Schedule readiness.
- Stale/recheck state.

Rules:

- Composes `StatusBadge`.
- Supports max visible items with wrap.
- Must not use color alone.

### `StatePanel`

Purpose:

Shared empty/loading/error/warning/disabled/success-ready state presentation.

Props:

- Tone.
- Title.
- Description.
- Primary action.
- Secondary action.
- Optional details summary/details.
- Optional icon.

Use for:

- Empty workspace.
- Empty table/list.
- Stale navigation target.
- Blocked launch.
- Diagnostics warning.
- Failed load.
- Disabled action explanation.

Rules:

- Operations-style compact panel, not marketing hero.
- Long details collapsed by default.
- Action labels must name the next step.

### `ErrorDetails`

Purpose:

Safe display for long runtime/system/validation error details.

Behavior:

- Short summary visible by default.
- Details collapsed by default.
- Copy details action.
- Monospace/details area wraps or scrolls without breaking layout.
- Works inside panels, dialogs, graph issue panel, and detail panels.

### `TableShell`

Purpose:

Shared table/list workspace shell.

Slots/props:

- Header/title.
- Toolbar slot.
- Column header slot or table children.
- Bounded scroll body.
- Empty/loading/error slot.
- Selected row state.
- Optional detail panel slot.

Rules:

- Owns scroll containment.
- Allows table interior horizontal scroll only within bounded region.
- Does not know domain DTOs.
- Supports compact density and row hover/focus.

### `DataToolbar`

Purpose:

Shared search/filter/action toolbar for data-heavy workspaces.

Slots/props:

- Search input.
- Filter chips.
- Segmented view control.
- Refresh action.
- Export/action slot.
- Result count or active filter summary.

Rules:

- Fits in page header or table header.
- Secondary metadata hides before primary actions on compact widths.

### `DetailPanel`

Purpose:

Shared master-detail detail area.

Slots/props:

- Title.
- Subtitle/context.
- Metadata.
- Status.
- Actions.
- Section list.
- Empty/stale/error state.

Rules:

- Can be right panel or bottom panel depending on screen.
- Supports dense key-value content.
- Does not expose unsafe raw data by default.

### `KeyValueList`

Purpose:

Shared metadata and diagnostics display.

Use for:

- Evidence metadata.
- Identity posture.
- Run details.
- Diagnostics.
- Settings summaries.

Features:

- Label/value rows.
- Monospace value option.
- Redacted/sanitized display option.
- Copy action only when safe and explicitly enabled.
- Wrapping rules for long safe values.

### `ConfirmActionDialog`

Purpose:

Shared high-impact/destructive confirmation.

Required props:

- Action name.
- Affected scope.
- Consequence.
- Confirm label.
- Cancel label.
- Tone: `destructive`, `warning`, `neutral`.

Rules:

- Must name what will be affected.
- Must not use browser-native confirm.
- Must preserve in-app dialog style.

### `EmptyState`

Purpose:

Lightweight empty state when a full `StatePanel` is too heavy.

Rules:

- Has concise title and next action.
- Does not use decorative hero treatment.
- Can be embedded in tables, panels, dialogs.

## Reference Migration Scope

Foundation implementation must migrate enough real UI to prove the system.

### 1. App Shell Reference

Requirements:

- Sidebar/page geometry uses new layout foundation.
- Sidebar order remains unchanged:
  Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings.
- Overview remains default.
- Existing routing behavior remains unchanged.
- Compact desktop behavior is defined for shell.
- App shell must not introduce page-level horizontal overflow.

Expected files:

- `src/layouts/AppShell.tsx`
- `src/layouts/AppSidebar.tsx`
- `src/styles/layout.css`
- `src/styles/responsive.css`
- Optional new `src/components/layout/PageFrame.tsx`

### 2. Page Header / Command Region Reference

Requirements:

- Replace ad hoc header composition in reference areas with `CommandRegion` or
  updated `PageHeader`.
- Header supports title, context, status, primary action, secondary actions, and
  utility actions.
- Use the same header anatomy that later workspaces can copy.

Expected files:

- `src/components/layout/PageHeader.tsx`
- `src/components/patterns/CommandRegion.tsx`
- Reference usage in App Shell/Overview.

### 3. Overview Partial Reference

This is not the full Overview redesign. That can be refined by later shell or
overview-specific work if needed. Foundation only proves the shared patterns.

Migrate at least:

- One metrics/status region using `StatusCluster` or status primitives.
- Attention, empty, warning, or error region using `StatePanel`.
- One list/table/detail region using `TableShell`, `DetailPanel`, or
  `KeyValueList` when appropriate.

Rules:

- Preserve Overview data loading and navigation behavior.
- Do not change backend DTOs for this partial migration.
- Do not remove existing Overview content just to simplify layout.

Expected file:

- `src/features/overview/pages/OperationsOverviewPage.tsx`

### 4. Dialog Anatomy Sample

Migrate or add one representative shared dialog usage to prove:

- Standard header/body/footer anatomy.
- Independent body scroll.
- `1024x768` fit.
- Accessible close.
- Correct primary/secondary/destructive action hierarchy.

Good candidates:

- A shared confirmation path.
- A small existing dialog that does not require feature-specific deep redesign.

Do not migrate the full Workflow Settings or Recording Review dialogs in this
Foundation spec; those have dedicated child specs.

## Guardrails

### Allowed

- Add `components/patterns`.
- Add `tokens.css` and `components.css`.
- Refactor shared primitives to clearer variant APIs.
- Refactor App Shell/PageHeader/Overview reference usage.
- Move repeated layout class groups into primitives/patterns.
- Reduce feature CSS when replaced by patterns.
- Update frontend architecture docs if ownership changes.

### Not Allowed

- Backend/Electron IPC behavior changes.
- Workflow graph model changes.
- Runner behavior changes.
- Evidence/identity/schedule DTO changes.
- Full Workflow Settings redesign.
- Full Graph Builder redesign.
- Full Runs/Evidence/Identity/Schedules redesign.
- Broad copy/label changes in feature flows outside reference areas.
- Rewriting `src/App.tsx` business orchestration just for style.

### Large File Rule

If `src/App.tsx`, `src/App.css`, or a large feature page must be touched, keep
edits narrowly scoped:

- Separate layout/style composition from business logic.
- Do not reorder unrelated logic.
- Do not rename domain state unless necessary.
- Prefer adding small layout wrappers over rewriting the whole file.

## Accessibility Requirements

- Every icon-only control has accessible label and tooltip.
- Focus-visible states are visible against dark surfaces.
- Dialogs use Radix focus behavior and accessible titles/descriptions.
- State must not be color-only.
- Form controls expose labels and error/help text where applicable.
- Keyboard interaction must not regress existing graph or command behavior.

## Responsive Requirements

Primary target:

- Large desktop: `1440x1024`.
- Compact desktop: `1024x768`.

Rules:

- No page-level horizontal overflow.
- Sidebar can collapse to icon rail or compact treatment.
- Header actions wrap or collapse predictably.
- Dialogs fit viewport and body scrolls.
- Tables/lists keep interior scroll bounded.
- Secondary metadata hides before primary labels/actions.
- Button text must not clip.

## Security And Sanitization Display Requirements

Foundation components must make safe display easy:

- `KeyValueList` supports redacted/sanitized labels.
- `ErrorDetails` supports bounded/collapsed long details.
- `StatePanel` supports safe stale/unavailable states.
- `ConfirmActionDialog` names scope without exposing raw unsafe values.

Foundation must not introduce UI that displays:

- Cookies.
- Tokens.
- Proxy credentials.
- Browser storage.
- Raw arbitrary run outputs.
- Profile contents.
- Unnecessary absolute local paths.

## Required Tests And Checks

### Component Tests

Add/update focused tests for changed primitives and patterns.

Expected:

```bash
npm test -- src/components/ui/shadcn-components.test.tsx
```

Add tests when files are created:

- `Button`
- `IconButton`
- `Dialog`
- `Badge`/`StatusBadge`
- `StatePanel`
- `ConfirmActionDialog`
- `ErrorDetails`

Test examples:

- Variant class output is stable enough to confirm tone/size.
- Icon-only controls require or render accessible labels.
- Dialog renders title/description/body/footer.
- StatePanel renders primary and secondary actions.
- ErrorDetails collapses long details and exposes copy action.

### Layout And App Tests

Required when App Shell/PageHeader/Overview are touched:

```bash
npm test -- src/layouts/AppShell.test.tsx src/App.test.tsx
```

Required when CSS invariants change:

```bash
npm test -- src/AppCss.test.ts
```

### Type And Build Checks

Required:

```bash
npx tsc --noEmit
```

Run when Tailwind/Vite/CSS import behavior changes:

```bash
npm run build
```

Run Electron build only if Electron-facing files are unexpectedly touched:

```bash
npm run build:electron
```

### Visual Checks

Use browser/manual/Playwright visual review if implementation environment
supports it.

Verify:

- App Shell at `1440x1024`.
- App Shell at `1024x768`.
- Overview reference at `1440x1024`.
- Overview reference at `1024x768`.
- Dialog sample at `1024x768`.

Check:

- No horizontal page overflow.
- No overlapping text.
- No clipped button labels.
- Focus indicators visible.
- Dialog body scrolls instead of leaving viewport.
- Primary action hierarchy is clear.

## Documentation Requirements

Update docs only when ownership or visible behavior changes.

Likely docs:

- `docs/architecture/frontend.md` if new `components/patterns` ownership is
  introduced.
- `docs/domain/user-visible-invariants.md` if visible shell/header behavior,
  responsive behavior, or state behavior changes.
- `README.md` smoke checklist only if user-visible flow/labels/check sequence
  changes.

Final implementation response must mention:

- Whether `DESIGN.md` was consulted.
- Tests/checks run.
- Docs updated or why docs did not need updates.
- Any known residual risk.

## Acceptance Criteria

Foundation is complete when all are true:

- `components/ui`, `components/layout`, and `components/patterns` ownership is
  clear in code and docs where needed.
- CSS file ownership is clear and token usage is centralized.
- Shared primitives use Tailwind utility + `cva`/Radix patterns where
  appropriate.
- Product patterns exist for command region, state panel, status cluster,
  detail/table/key-value/error/confirmation needs.
- App Shell uses the foundation without changing navigation behavior.
- Page header or command region has a reference implementation.
- Overview has a partial reference migration using the new patterns.
- At least one dialog/confirmation path proves the standard anatomy.
- Compact `1024x768` behavior is defined for shell/header/dialog reference
  surfaces.
- Existing behavior and IPC boundaries remain unchanged.
- Required tests/checks pass or failures are documented with exact blockers.

## Handoff To Child Spec 02

The next child spec, Shell Navigation Search Alerts, should build on:

- `PageFrame`
- `PageHeader` or `CommandRegion`
- `StatePanel`
- `StatusCluster`
- `DataToolbar`
- `DetailPanel`
- Shared responsive shell rules
- Shared safe/stale display patterns

Spec 02 should not recreate these primitives. If it needs a missing shell/search
pattern, it should extend this foundation rather than starting a parallel UI
system.
