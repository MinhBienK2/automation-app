# Mission Control DONE Goal

Date: 2026-05-27

## Objective

Deliver the full Mission Control production adoption program end to end, across
all approved specifications, and stop only when the program is genuinely DONE:
implemented, tested, documented, committed, and verified against the acceptance
criteria.

The implementation agent must not stop after a partial phase just because one
spec is finished. After each spec-sized milestone, commit the completed work,
create a compact-ready checkpoint, then continue with the next milestone until
the full program is complete.

## Approved Source Specs

Implement from these approved documents, in this order:

1. `docs/superpowers/specs/2026-05-27-mission-control-foundation-existing-workspaces-design.md`
2. `docs/superpowers/specs/2026-05-27-mission-control-operations-overview-design.md`
3. `docs/superpowers/specs/2026-05-27-mission-control-evidence-explorer-design.md`
4. `docs/superpowers/specs/2026-05-27-mission-control-identity-lab-design.md`
5. `docs/superpowers/specs/2026-05-27-mission-control-cross-workspace-traceability-polish-design.md`

The original Stitch suite remains the visual reference:

- `docs/superpowers/specs/2026-05-27-mission-control-stitch-design.md`
- `.stitch/DESIGN.md`
- `.stitch/designs/`
- `.stitch/prompts/`

## Execution Rule

Run the program as one continuous delivery effort:

1. Read the repo instructions and relevant docs before implementation.
2. Use TDD before runtime behavior changes.
3. Implement one spec-sized milestone at a time.
4. Run the focused tests/checks for that milestone.
5. Update source-of-truth docs when behavior, commands, workflow, or UI
   ownership changes.
6. Commit the milestone with an AI attribution trailer.
7. Record a compact-ready checkpoint summary.
8. Continue immediately to the next milestone.
9. Stop only after all five specs are complete and final verification passes.

## Compact Checkpoint Rule

After each committed milestone, produce a compact-ready checkpoint containing:

- Current branch and latest commit.
- Milestone/spec completed.
- Files changed at a high level.
- Tests/checks run and their result.
- Docs updated or why docs were unchanged.
- Remaining specs/milestones.
- Known blockers or residual risks.
- Exact next action.

The checkpoint should be concise enough to survive context compaction and allow
work to resume without restarting analysis.

## Milestone Commit Gates

Each milestone is complete only when:

- The spec acceptance criteria for that milestone are satisfied.
- Focused tests pass.
- Typecheck/build commands relevant to changed files pass or any failure is
  documented with a concrete blocker.
- The working tree contains only intended changes.
- A commit exists for the milestone.
- The checkpoint summary is ready.

Do not combine unrelated milestones into a single oversized unreviewable commit
unless the implementation plan proves they cannot be separated safely.

## Implementation Milestones

### Milestone 1: Foundation And Existing Workspaces

Deliver the Mission Control shell/design system adoption for existing
workspaces, Graph Builder launch confirmation, validation/failure detail
overlay, and the user-facing `Runs` label.

Primary spec:

- `2026-05-27-mission-control-foundation-existing-workspaces-design.md`

Expected commit theme:

- `feat: adopt Mission Control shell and existing workspaces`

### Milestone 2: Operations Overview

Deliver the durable Overview workspace, operations read model, attention
records, Overview navigation, and focused durable-run receiver behavior.

Primary spec:

- `2026-05-27-mission-control-operations-overview-design.md`

Expected commit theme:

- `feat: add Mission Control operations overview`

### Milestone 3: Evidence Explorer

Deliver the Evidence route, evidence read model, run-source provenance,
artifact preview/reveal/export commands, filters, details, and run/workflow
navigation.

Primary spec:

- `2026-05-27-mission-control-evidence-explorer-design.md`

Expected commit theme:

- `feat: add Mission Control evidence explorer`

### Milestone 4: Identity Lab

Deliver the Identities route, identity read model, managed/historical identity
details, sanitized diagnostics, close retained session, reset guards, and
Evidence identity navigation.

Primary spec:

- `2026-05-27-mission-control-identity-lab-design.md`

Expected commit theme:

- `feat: add Mission Control identity lab`

### Milestone 5: Cross-Workspace Traceability And Polish

Deliver final sidebar order, typed in-memory navigation targets, command bar
bounded search/actions, Settings parity, compact desktop behavior, final
traceability links, and suite-wide regression polish.

Primary spec:

- `2026-05-27-mission-control-cross-workspace-traceability-polish-design.md`

Expected commit theme:

- `feat: complete Mission Control traceability polish`

## Final DONE Criteria

The Mission Control program is DONE only when:

- All five implementation milestones are committed.
- The final sidebar order is `Overview`, `Workflows`, `Runs`, `Evidence`,
  `Schedules`, `Identities`, `Settings`.
- `Overview` is the default entry point.
- Existing workflow authoring, runs, schedules, settings, browser identity, and
  evidence behavior still work.
- New Overview, Evidence, Identity Lab, Settings parity, and traceability
  behavior meet their approved acceptance criteria.
- Security/sanitization boundaries from the specs are preserved.
- Compact desktop behavior is verified at `1024x768`.
- Focused tests, typecheck/build, and any required visual checks pass or have
  explicit blocker notes.
- Source-of-truth docs and smoke checklist are accurate.
- The final working tree is clean.

## Stop Conditions

Do not stop between specs after a successful milestone commit.

Stop only when one of these is true:

- The full DONE criteria above are satisfied.
- A command or environment failure blocks further progress and cannot be worked
  around without user action.
- A spec conflict is discovered that requires a product decision.
- The user explicitly asks to stop or change direction.

When stopping for a blocker, record the compact-ready checkpoint and state the
single next decision or action needed to continue.
