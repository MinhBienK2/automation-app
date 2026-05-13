# Repo Legacy Cleanup Inventory

## Scan Inputs

- Source/docs route read: `docs/README.md`, `docs/task-routes.md`,
  `docs/agent-workflow.md`, broad product route docs.
- File count under `src`, `electron`, and `docs`: 203 files.
- TypeScript source/test file count under `src` and `electron`: 104 files.
- Local static tool note: `npx --no-install knip --reporter json` was not
  available because `knip` is not installed locally. No dependency was added.

## Contracted Compatibility To Retain

These are legacy/compatibility by name but still documented and tested current
contracts:

- `WorkflowStep`, `workflow_steps`, and generated linear graph fallback.
- `WorkflowSummary.step_count`.
- `get_workflow_browser_config` and `save_workflow_browser_config` wrappers
  over Workflow Settings Browser Launch.
- Graph v1 migration in `electron/backend/workflowGraphMigration.ts`.
- Compatibility/planned action configs that must remain loadable or fail
  explicitly: `switch_frame`, `save_session`, `load_session`, `set_secret`,
  `detect_challenge`, `pause_for_human`, `resume_when_condition`,
  `fallback_selector`, `retry_step`, and `checkpoint`.

Deleting these requires a contract-migration plan, not a blind cleanup.

## Removable Or Suspicious Findings

- `src/assets/react.svg` is a starter asset with no repo references.
- `public/vite.svg` is only referenced by the Vite favicon link in
  `index.html`; it is starter branding, not product branding.
- `dist/vite.svg` exists in the working tree but is not tracked by git.
- No source todo/fixme markers were found. Matches for obsolete fields
  are migration code/tests that intentionally drop old settings/action knobs.

## Oversized Module Findings

Top candidates by line count:

- `src/features/workflows/lib/stepHelpContent.ts` at 2371 lines.
- `electron/backend/runner.ts` at 1914 lines.
- `electron/backend/runner.test.ts` at 1876 lines.
- `electron/backend/graphCompiler.ts` at 1815 lines.
- `electron/backend/commands.ts` at 1316 lines.
- `src/App.tsx` at 1053 lines.
- `src/features/workflows/components/WorkflowGraphEditor.tsx` at 983 lines.

Refactor order should start where extraction can preserve public contracts and
has strong focused tests. The help catalog is the safest first extraction target
because it is pure data/formatting and already has focused tests.

## Folder Structure Notes

Current top-level source ownership is coherent:

- `src/components` for shared UI primitives/layout helpers.
- `src/features/settings` for app-level settings.
- `src/features/workflows` for workflow pages/components/libs.
- `src/lib` for renderer-wide bridge/UI utilities.
- `src/tests` for renderer mocks/utils.
- `src/types` for shared renderer DTOs.
- `electron/backend` for command, persistence, compiler, migration, and runner.

No folder move is justified before reducing oversized workflow/backend modules.

## Next Safe Slice

Plan 2 should remove the starter assets and Vite favicon link:

- Delete `src/assets/react.svg`.
- Delete `public/vite.svg`.
- Remove the `/vite.svg` favicon link from `index.html`.

This is an asset cleanup, not a runtime behavior refactor. Verification should
use `rg` to prove no references remain plus `npm run build:renderer` or
equivalent TypeScript/Vite build coverage.
