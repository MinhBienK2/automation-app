# Repo Legacy Cleanup And Refactor Design

## Objective

Audit the whole repository for removable legacy code, unused code, stale tests,
stale docs, oversized modules, and folder ownership problems. Delete or refactor
only items that are proven safe by code search, tests, contracts, and runtime
boundaries. Keep repeating small verified plans until there are no actionable
repo findings left.

## Scope Rules

Not every `legacy` reference is removable. Current product contracts still
preserve several compatibility surfaces:

- Legacy workflow step rows and `WorkflowStep` DTOs are compatibility data.
- `step_count` remains part of `WorkflowSummary` until the summary contract is
  renamed.
- Browser-config commands remain wrappers over `settings.browser_launch`.
- Hidden compatibility/planned action configs must remain loadable or fail
  explicitly when docs and tests say so.
- Graph v1 migration remains required for saved/imported older graphs.

These are not deleted in the first pass unless a focused plan changes the
contract, updates docs, and proves all call sites have moved.

## Removal Criteria

Code, tests, docs, or assets can be removed when all of these are true:

1. `rg` and import graph checks show no production caller.
2. Existing contracts do not name it as a compatibility surface.
3. Tests can be written or adjusted first to prove the intended absence.
4. Focused tests, typecheck, and relevant Electron checks pass.
5. Docs and smoke checklist are updated when behavior or ownership changes.

If any criterion is uncertain, record it as retained compatibility or a later
contract-migration candidate instead of deleting it.

## Audit Method

Each cleanup cycle will:

1. Search for `legacy`, `compatibility`, `planned_hidden`, `deprecated`,
   `obsolete`, `unused`, todo markers, old command names, hidden actions, old graph
   versions, and stale docs terms.
2. Run static usage checks with the available local toolchain. If a tool is not
   installed, use TypeScript, `rg`, and import search instead of adding new
   dependencies.
3. Rank oversized files by line count and inspect whether they mix separate
   responsibilities.
4. Pick one narrow slice with clear evidence.
5. Write or update a failing test first for code behavior/refactor changes.
6. Implement the smallest removal or extraction.
7. Run focused checks, then broader checks when the slice changes shared types,
   Electron commands, runner behavior, or folder ownership.
8. Commit before moving to the next slice.

## Initial Findings To Investigate

- Large modules:
  - `src/features/workflows/lib/stepHelpContent.ts`
  - `electron/backend/runner.ts`
  - `electron/backend/graphCompiler.ts`
  - `electron/backend/commands.ts`
  - `src/App.tsx`
  - `src/features/workflows/components/WorkflowGraphEditor.tsx`
- Compatibility action surfaces:
  - `switch_frame`, `save_session`, `load_session`, `set_secret`
  - `detect_challenge`, `pause_for_human`, `resume_when_condition`
  - `fallback_selector`, `retry_step`, `checkpoint`
- Compatibility data and commands:
  - `WorkflowStep`, `workflow_steps`, `step_count`
  - `get_workflow_browser_config`, `save_workflow_browser_config`
  - graph v1 migration
- Possible stale generated or starter assets:
  - `dist/vite.svg`
  - `public/vite.svg`

## Plan Boundaries

Plan 0 writes and commits this spec.

Plan 1 produces a repo inventory: categorized legacy references, unused/static
findings, oversized module candidates, and a first safe deletion/refactor slice.
This plan may be docs-only if it records findings, or code-changing if it
finds an obvious unused asset with tests/checks.

Plan 2 and later repeat narrow implementation cycles. Each code-changing plan
must follow RED/GREEN/REFACTOR and commit after tests pass.

The final audit must map every explicit objective item to concrete evidence:
legacy scan, unused scan, deletion/refactor commits, docs sync, tests, typecheck,
Electron build where relevant, and clean worktree.

## Verification Baseline

Use the smallest relevant checks first. Before completion, run:

- `npm test`
- `npx tsc --noEmit`
- `npm run build:electron`
- `git diff --check`
- focused `rg` audits for stale legacy terms and known deleted artifacts

## Self-Review

This spec intentionally does not promise blind deletion of every string named
`legacy`; the current product model explicitly requires some compatibility.
The success condition is a clean, evidenced repo audit with all removable legacy
and unused items deleted, not removal of contracted compatibility by accident.
