# Mission Control UI/UX Upgrade Child Spec 12: Cross-Cutting UI Hardening

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec closes the full product UI/UX upgrade program after child specs
01-11. It owns final consistency, accessibility, responsiveness, state handling,
security display boundaries, and verification.

## Brainstorming Decisions

Question: should hardening introduce new product features?

Approved answer: no. This pass fixes inconsistencies and missing states across
implemented specs. Feature work belongs to the relevant child spec.

Question: should visual QA be manual only?

Approved answer: no. Use focused tests for behavior/CSS invariants and manual or
Playwright visual checks for layout risks that unit tests cannot prove.

Question: what is the main success criterion?

Approved answer: an agent can implement specs 01-11 and then run this hardening
pass to catch the details that usually break: overflow, stale states, focus,
copy, sensitive data exposure, and inconsistent components.

## Goal

Make the completed redesign feel like one coherent desktop operations product
rather than a set of separately polished screens.

The implementation must:

1. Normalize shared layout, controls, status, dialogs, and empty/error states.
2. Verify compact desktop behavior.
3. Verify keyboard and accessibility basics.
4. Verify sensitive data boundaries.
5. Remove one-off CSS that conflicts with `DESIGN.md`.
6. Update docs/checklists when behavior or verification changes.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/cross-feature-impact-map.md`
- `docs/architecture/frontend.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/run-state.md`
- Master UI/UX upgrade spec
- Child specs 01-11

Primary source areas:

- `src/App.tsx`
- `src/layouts/`
- `src/components/ui/`
- `src/components/layout/`
- `src/features/`
- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/workflows.css`
- `src/styles/workflow-graph.css`
- `src/styles/schedules.css`
- `src/styles/modals.css`
- `src/styles/responsive.css`
- `src/AppCss.test.ts`
- `README.md`
- relevant `docs/` files when behavior/docs changed

## Scope Boundaries

### In Scope

- Shared component consistency.
- CSS cleanup.
- Responsive hardening.
- Accessibility pass.
- Empty/loading/error/stale state normalization.
- Sensitive display audit.
- Test/checklist updates.
- Final docs sync.

### Out Of Scope

- New workflows or feature systems.
- Backend architecture rewrites.
- Replacing design system.
- Adding unrelated settings.
- Broad refactors not needed for UI consistency.

## Shared UI Consistency Checklist

Controls:

- Buttons use shared `Button` variants.
- Icon-only actions use `IconButton`, accessible label, and tooltip.
- Binary options use `SwitchField`.
- Mutually exclusive compact options use `SegmentedControl`.
- Select inputs use shared `Select` where practical.
- Dialogs use shared `Dialog` primitives.
- Guarded destructive actions use confirmation patterns from Foundation.

Status:

- active/running: cyan;
- success: green;
- attention/stale/validation: amber;
- failure/destructive: red;
- neutral metadata: muted text.

Copy:

- Primary commands use verbs and scope: `Launch Run`, `New Workflow`,
  `Save Settings`, `Export Selection`.
- Destructive commands name affected scope.
- Empty states give one or two real next actions.
- Avoid in-app feature explanations that read like documentation.

## Layout Hardening Checklist

Verify each workspace:

- Overview.
- Workflow Library.
- Recording Review.
- Graph Builder.
- Workflow Settings.
- Runs.
- Evidence Explorer.
- Identity Lab.
- Schedules.
- App Settings.

For each workspace:

- no horizontal page overflow at desktop and `1024x768`;
- no text overlap;
- buttons fit labels or wrap cleanly;
- dialogs stay within viewport;
- tables hide secondary metadata first;
- sidebars/drawers remain reachable;
- focused/stale target markers are visible;
- loading states preserve geometry;
- empty states do not look like errors;
- long ids, timestamps, paths allowed by contract, and error text wrap safely.

## Accessibility Checklist

Keyboard:

- sidebar destinations reachable;
- command/search controls reachable;
- dialogs trap focus through existing dialog primitive;
- Escape closes non-destructive popovers/dialogs where expected;
- palette search and results are keyboard usable;
- graph toolbar controls have labels;
- row actions have accessible names;
- destructive confirmations can be cancelled by keyboard.

Semantics:

- one clear `h1` per page/workspace;
- panels/regions have useful labels;
- status/error messages use appropriate alert/status treatment;
- tables have headers;
- form fields have labels;
- selected tabs/rows communicate selected state beyond color.

Visual accessibility:

- focus ring visible against dark surfaces;
- state is not color-only;
- small metadata remains readable;
- disabled controls have sufficient explanation where consequential.

## Sensitive Data Display Audit

Search, Overview, Runs, Evidence, Identity, Settings, Graph issue details, and
dialogs must not expose:

- cookies;
- tokens;
- proxy passwords;
- proxy URL credentials;
- browser storage;
- raw profile contents;
- raw diagnostic payloads;
- arbitrary run outputs;
- unnecessary absolute local paths.

Allowed technical values:

- run ids;
- workflow ids when useful;
- identity ids;
- schedule ids in stale messages;
- sanitized evidence ids;
- bounded command-facing error messages;
- operator-entered fields already visible in relevant forms.

Long raw details that are allowed must be collapsed by default and copyable only
when useful for debugging.

## State Handling Checklist

Every major workspace must cover:

- initial loading;
- empty data;
- loaded data;
- command pending;
- command success;
- command failure;
- stale navigation target;
- disabled action with reason when consequential.

Do not clear useful loaded data just because a refresh or command fails.

## CSS Hardening Requirements

Consolidate repeated style rules when safe:

- page headers;
- panel headings;
- status pills/badges;
- toolbar rows;
- table wrappers;
- detail lists;
- empty states;
- dialog bodies;
- responsive stacks.

Avoid:

- one-off hard-coded colors outside token palette;
- nested decorative card styling;
- negative letter spacing;
- viewport-width font scaling;
- giant hero typography;
- decorative gradient/orb backgrounds;
- uncontrolled min-widths that cause overflow.

## Documentation Sync Requirements

Update docs when implementation changes:

- `docs/architecture/frontend.md` for ownership/component changes.
- `docs/domain/user-visible-invariants.md` for user-visible behavior changes.
- `docs/contracts/electron-ipc.md` for command payload/response changes.
- `docs/contracts/workflow-types.md` for DTO changes.
- `docs/contracts/run-state.md` for run-state changes.
- `docs/task-routes.md` if routes/checks change.
- `README.md` smoke checklist if user-visible workflow behavior changes.

If only CSS/component presentation changes and behavior/contracts do not change,
state that docs did not need updates in final implementation response.

## Verification Plan

Focused checks by touched area:

- component/page tests for every changed workspace;
- `npm test -- src/AppCss.test.ts` for CSS invariants;
- `npx tsc --noEmit`;
- `npm run build:electron` if Electron types/commands changed.

Broad checks before final completion:

- `npm test`;
- `npm run build`;
- manual or Playwright visual pass at:
  - desktop wide;
  - `1366x768`;
  - `1024x768`.

Manual smoke checklist:

- open every sidebar workspace;
- search and open one typed target;
- focus Alerts to Overview;
- create/open workflow;
- open Graph Builder and palettes;
- open Workflow Settings all sections;
- start a run or verify blocked launch state;
- open Runs;
- open Evidence detail;
- open Identity detail;
- create/edit schedule dialog;
- open App Settings diagnostics.

## Acceptance Criteria

- The UI feels coherent across all redesigned screens.
- Compact desktop does not break critical workflows.
- Keyboard/accessibility basics are covered.
- Sensitive data boundaries are verified.
- Tests and docs match changed behavior.
- No child spec remains with unimplemented cross-cutting UI debt hidden outside
  the final hardening pass.

