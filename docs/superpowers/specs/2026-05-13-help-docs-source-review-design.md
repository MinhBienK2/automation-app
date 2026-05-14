# Help, Docs, And Source Review Cleanup Design

## Objective

Refresh the in-app help popups and current documentation so they describe the
application that exists now, not removed or planned surfaces. Remove stale help
for settings sections and fields that are no longer visible, keep compatibility
actions truthful, and make the help content easier to keep aligned with source
code.

## Current Mismatches Found

- Workflow Settings currently has five visible sections: General, Run Policy,
  Browser Launch, Environment, and Owned Test Gates.
- `workflowSettingsHelp` still includes old or hidden sections such as
  `legacy_environment`, Triggers, and Advanced, and some visible sections still
  describe removed Execution defaults, device presets, user-agent launch fields,
  mobile/touch fields, challenge policy, and wait-between-nodes controls.
- The action help catalog still presents legacy XPath and per-action timing
  knobs as primary setup for many visible actions even though the current editor
  uses structured target fields and simplified defaults. Legacy XPath remains a
  compatibility input, but it should not be the normal help-first path.
- `README.md` smoke steps still mention removed Workflow Settings sections and
  fields.
- Current docs mostly describe the Electron/CloakBrowser graph-first app, but a
  few product/lifecycle lines still mention removed settings concepts.

## Decisions

- Keep help bilingual in English and Vietnamese.
- Keep action help for every serialized `ActionType`, including hidden
  compatibility and planned actions, because imported workflows can still expose
  those payloads.
- Separate visible editor field names from legacy compatibility field names in
  action help. Visible actions should lead with fields the current editor shows:
  structured target locator type/value/constraints, business values, outputs,
  and visible options.
- Keep compatibility wording explicit for launch-time and planned actions:
  configure launch-time behavior in Workflow Settings, and planned actions are
  retained for DTO/import compatibility rather than promoted as current
  authoring features.
- Update current docs under `docs/` and `README.md`; leave
  `docs/superpowers/` historical archive content untouched except for this spec.
- Update `AGENTS.md` only if the audit shows it is stale against current package
  manager, workflow, routes, or required checks.

## Implementation Plan

### Plan 1: Help Popup Catalog And Source Refactor

- Add failing tests that prove settings help only covers visible sections and no
  longer references removed sections/fields.
- Add failing tests that prove action help field references lead with current
  structured target fields and do not advertise removed visible defaults such as
  click retry interval, post-click wait, or XPath-only setup.
- Refactor help catalog code so shared target field groups and no-field actions
  are centralized instead of duplicated across action cases.
- Update action and settings help copy to match current UI labels, field names,
  capability classes, outputs, and safety boundaries.
- Run focused tests:
  `npm test -- src/features/workflows/lib/stepHelpContent.test.ts`,
  `npm test -- src/features/workflows/components/StepHelpModal.test.tsx`,
  `npm test -- src/features/workflows/lib/workflowSettings.test.ts`.
- Commit after tests pass.

### Plan 2: Current Docs And Agent Instructions

- Update current docs routed by this task: product model, workflow lifecycle,
  action taxonomy/contracts, frontend architecture, testing notes if needed, and
  README smoke checklist.
- Remove references in current docs to removed Workflow Settings sections and
  fields. Keep historical specs untouched.
- Audit `AGENTS.md` with the `agents-md` rules and update it only if it is stale
  or missing required high-signal instructions.
- Run docs-relevant checks and focused tests impacted by docs/source changes.
- Commit after checks pass.

### Plan 3: Source Review Verification And Final Audit

- Run a broader source review for help/docs drift using `rg` against current
  docs and source.
- Run `npx tsc --noEmit`; run additional focused tests if the refactor touches
  shared TypeScript behavior.
- Confirm git history contains a commit per completed plan.
- Complete a prompt-to-artifact audit against the user objective before marking
  the goal complete.

## Acceptance Criteria

- Help popups describe only current visible settings sections and current action
  editor fields, while clearly labeling compatibility/planned actions.
- Tests fail before help catalog changes and pass after implementation.
- Current docs and README agree with source for touched workflow settings, action
  help, action visibility, and runner behavior.
- No stale current-doc references remain for removed Workflow Settings sections:
  Execution, Variables, Triggers, Advanced, or old Browser device/challenge
  fields, except where explicitly described as historical or removed.
- `AGENTS.md` remains concise and accurate.
- Each plan is committed after tests/checks pass.
