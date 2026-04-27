# Workflow UI Refactor Implementation Plan

Date: 2026-04-27

## Plan 1: Spec And Baseline

Tasks:

- Read current `App.tsx`, `App.css`, `App.test.tsx`, `DESIGN.md`, and existing MVP docs.
- Write this implementation plan and the design spec.

DONE:

- Spec exists at `docs/superpowers/specs/2026-04-27-workflow-ui-refactor-design.md`.
- Plan exists at `docs/superpowers/plans/2026-04-27-workflow-ui-refactor-plan.md`.
- Scope explicitly preserves backend commands and runner behavior.

## Plan 2: Navigation TDD

Tasks:

- Add a focused failing test for separate Workflow List and Workflow Detail screens.
- Assert the initial screen is the list.
- Assert `View Details` opens detail and hides the create workflow form.
- Assert `Back to Workflows` returns to the list.
- Run the focused test and confirm it fails for the expected reason before production edits.

DONE:

- The new test fails before implementation because the current UI still uses the combined screen and lacks the new navigation copy.

## Plan 3: Component And Module Split

Tasks:

- Add shared workflow types.
- Add typed Tauri API helpers.
- Add pure UI helpers.
- Move list, detail, step list, step form, run status, and monitor into focused components.
- Keep `App.tsx` responsible only for state orchestration and command callbacks.

DONE:

- `App.tsx` no longer contains component implementations for the list, builder, step form, monitor, or helper functions.
- Existing action config, run-state, and command payload shapes are unchanged.
- The focused navigation test passes.

## Plan 4: Design-System Restyle

Tasks:

- Replace the light theme in `src/App.css`.
- Style list and detail screens as dark, border-defined product surfaces.
- Keep dense operational layout and responsive behavior.
- Preserve accessible labels and button names used by tests.

DONE:

- Primary surfaces use the `DESIGN.md` dark palette.
- No primary app area uses the old light theme.
- Existing user workflow controls remain visible and usable on desktop and mobile widths.

## Plan 5: Docs Architect Output

Tasks:

- Analyze the final frontend and Rust structure.
- Write agent-readable architecture documentation with system overview, components, data flow, command boundaries, testing, and maintenance guidance.

DONE:

- A Markdown technical guide exists under `docs/superpowers/architecture/`.
- The guide links to concrete source files and explains what each agent should edit for common changes.

## Plan 6: Verification

Tasks:

- Run `npm test -- src/App.test.tsx`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Fix failures until the checks pass.

DONE:

- Focused frontend tests pass.
- TypeScript check passes.
- Build passes or any external blocker is clearly documented.
