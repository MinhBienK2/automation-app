# Agent Docs Design

Date: 2026-04-29

## Summary

Create a new `/docs` agent manual for the repository. The manual is for coding agents only. It must be concise, task-routed, business-aware, and always synchronized with the code through an explicit `AGENTS.md` requirement.

The existing `docs/superpowers` tree remains a historical planning archive. Agents may use it for past context, but it must not be treated as source of truth for current behavior.

## Goals

- Give coding agents the shortest reliable path from a task request to the relevant code, contracts, business rules, and verification commands.
- Make `/docs` a mandatory, always-synced source of truth for documented behavior and contracts.
- Reduce wasted exploration tokens by routing agents to a small set of relevant docs per task.
- Help agents detect hidden business and technical coupling before changing code.
- Keep documentation useful for implementation work, not product marketing or historical planning.

## Non-Goals

- Do not migrate old `docs/superpowers` specs or plans into current docs.
- Do not create long-form user-facing product documentation.
- Do not duplicate large blocks of code in Markdown.
- Do not document roadmap, phase history, speculative features, or stale decisions in `/docs`.

## Source Of Truth Model

`/docs` is not a soft reference. It is part of the repository's definition of done for coding agents.

Agents must treat current code and `/docs` as synchronized sources of truth. If a task changes documented behavior, contracts, ownership, task routes, business rules, verification expectations, or user-visible workflow semantics, the relevant docs must be updated in the same change.

If docs and code disagree when an agent starts work, the agent must verify the code, fix the docs for the touched area, and continue from the synchronized state.

The intended rule is:

```text
Current code and /docs must agree for every touched area before final response.
```

## AGENTS.md Enforcement

Add a `Docs Sync Requirement` section to `AGENTS.md`.

The requirement should be equivalent to the existing TDD requirement in force:

1. Before implementing any feature, bug fix, refactor, behavior change, command/API change, validation change, persistence change, runner change, or user-visible workflow change, agents must read the relevant files under `/docs`.
2. Agents must start with `docs/README.md` and `docs/task-routes.md`.
3. Agents must then read only the route-specific domain, architecture, contract, and maintenance docs required for the task.
4. Agents must update `/docs` in the same change when behavior, contracts, business rules, task routing, verification expectations, file ownership, or cross-feature impact changes.
5. Before final response, agents must verify docs and code agree for the touched area.

Allowed exceptions:

- Formatting-only changes.
- Comment-only changes.
- Generated files.
- Dependency lockfile churn with no behavior or command changes.
- Throwaway prototypes.

Final responses for code changes must include:

- Tests or checks run.
- Whether `/docs` was updated.
- If `/docs` was not updated, why the touched behavior or contracts did not require it.

## Directory Structure

Create this structure:

```text
docs/
  README.md
  agent-workflow.md
  task-routes.md

  domain/
    product-model.md
    workflow-lifecycle.md
    action-taxonomy.md
    execution-semantics.md
    user-visible-invariants.md
    cross-feature-impact-map.md

  architecture/
    overview.md
    frontend.md
    command-boundary.md
    domain.md
    persistence.md
    runner.md
    testing.md

  contracts/
    workflow-types.md
    tauri-commands.md
    action-configs.md
    run-state.md

  maintenance/
    docs-sync-policy.md
    docs-rules.md
    freshness-checklist.md
    token-budget.md
```

`docs/superpowers` remains in place as an archive.

## Entry Point

`docs/README.md` is the mandatory entry point.

It must state:

- `/docs` is for coding agents only.
- `docs/superpowers` is historical and not source of truth.
- The reading path is `README.md` -> `task-routes.md` -> route-specific docs -> code verification.
- Docs must be updated with code changes that affect documented behavior or contracts.
- Agents should prefer small, route-specific reading over scanning all docs.

## Agent Workflow

`docs/agent-workflow.md` describes the standard work loop:

1. Read `docs/README.md`.
2. Read `docs/task-routes.md`.
3. Select the route or routes matching the task.
4. Read only the domain, architecture, contract, and maintenance files named by the route.
5. Inspect the current source files listed by the route.
6. Use TDD for behavior changes, following `AGENTS.md`.
7. Implement the smallest scoped change.
8. Run focused checks first, then broader checks when the blast radius requires it.
9. Update `/docs` when the change affects documented behavior, contracts, ownership, or verification.
10. Confirm docs and code agree before final response.

## Task Routes

`docs/task-routes.md` is the router that minimizes token usage.

Each route should include:

- When to use this route.
- Read first.
- Likely source files.
- Contracts to protect.
- Hidden coupling to check.
- Required or recommended tests/checks.
- Docs to update if behavior changes.

Initial routes should cover:

- Add or change an action type.
- Change workflow UI behavior.
- Change user-facing styling or layout.
- Change a Tauri command.
- Change domain validation.
- Change SQLite persistence.
- Change runner behavior.
- Change run status or test-step monitoring.
- Fix a bug.
- Refactor a module.
- Update tests only.

## Business And Domain Docs

The domain docs exist so agents understand business behavior, not only file locations.

### `domain/product-model.md`

Explain the product model:

- The app is a Tauri desktop MVP for building and running browser automation workflows.
- A workflow is an ordered set of steps.
- A step has a name, action type, order index, and action-specific config.
- Users can create, edit, reorder, test, run, stop, and delete workflows.
- Outputs, screenshots, browser session state, and run progress are user-visible behavior.

### `domain/workflow-lifecycle.md`

Document lifecycle behavior:

- Create workflow.
- Open workflow detail.
- Add/edit/reorder/delete steps.
- Test through selected step.
- Run full workflow.
- Stop active run.
- Delete workflow.

Include user-visible invariants and likely code touchpoints for each lifecycle stage.

### `domain/action-taxonomy.md`

Group action types by business purpose:

- Navigation.
- Element interaction.
- Data capture.
- Browser and tab control.
- Session and identity.
- Network and device configuration.
- Human verification.
- Reliability.
- Orchestration.
- JavaScript and storage.
- Builder assist.

Do not use old phase plans as current truth. Verify current action definitions in code.

### `domain/execution-semantics.md`

Document runner semantics:

- Step order matters.
- Test-step execution runs from step 1 through the selected step.
- Failures and stops produce user-visible terminal states.
- Browser sessions stay open after success, failure, and stop unless cleanup behavior changes intentionally.
- Sleep is explicit wait behavior.
- Cancellation must remain responsive.
- Output and screenshot behavior is part of workflow semantics.

### `domain/user-visible-invariants.md`

List behavior agents must preserve unless the task explicitly changes it:

- Workflow steps remain ordered and contiguous after reorder/delete.
- TypeScript and Rust payload shapes stay compatible.
- Command-facing errors remain serializable.
- UI follows `DESIGN.md` for layout and styling changes.
- Run state remains understandable to users.
- Stop behavior must not leave the app in a misleading running state.

### `domain/cross-feature-impact-map.md`

Map hidden coupling. Examples:

- Action config changes affect TypeScript types, Rust serde enums, UI defaults, labels, summaries, validation, runner execution, persistence JSON compatibility, command tests, and smoke checklist expectations.
- Command changes affect frontend wrappers, tests, error handling, and Tauri invoke payloads.
- Runner changes affect run state, cancellation, progress reporting, command tests, and user-visible invariants.
- Persistence changes affect migrations, repository tests, list/detail screens, ordering behavior, and import/export behavior if present.

## Architecture Docs

Each architecture doc must be short and structured:

- Purpose.
- Ownership boundary.
- Key files.
- What belongs here.
- What does not belong here.
- Common change checklist.
- Related contracts.

Initial architecture files:

- `architecture/overview.md`
- `architecture/frontend.md`
- `architecture/command-boundary.md`
- `architecture/domain.md`
- `architecture/persistence.md`
- `architecture/runner.md`
- `architecture/testing.md`

## Contract Docs

Contract docs define sync points between layers.

### `contracts/workflow-types.md`

Cover the TypeScript/Rust workflow DTO relationship:

- `src/types/workflow.ts`
- Rust domain structs and serde output.
- Workflow, workflow summary, step, action config, and output shapes.

### `contracts/tauri-commands.md`

Cover command boundary rules:

- Command names.
- Payload conventions.
- Frontend wrapper ownership.
- `CommandError` serialization.
- Tests that protect command behavior.

### `contracts/action-configs.md`

Cover action config contracts:

- Serde tag shape.
- TypeScript action union.
- Default configs.
- Labels and summaries.
- Validation ownership.
- Runner executor mapping.
- Persistence JSON compatibility.

### `contracts/run-state.md`

Cover run lifecycle contracts:

- Status values.
- Progress reporting.
- Test-step monitor expectations.
- Cancellation/stop behavior.
- Browser-session terminal behavior.

## Maintenance Docs

### `maintenance/docs-sync-policy.md`

Define when docs must be updated and how agents verify agreement.

Required docs update triggers:

- Behavior changes.
- Contract or payload changes.
- Command name or command payload changes.
- Validation rule changes.
- Persistence schema or ordering changes.
- Runner semantics changes.
- User-visible workflow changes.
- Test expectation changes.
- File ownership or architecture boundary changes.

### `maintenance/docs-rules.md`

Rules for writing docs:

- Write for coding agents only.
- Keep files short and task-oriented.
- Avoid roadmap, history, and phase language.
- Avoid copying large source code.
- Prefer file paths, checklists, invariants, and verification commands.
- Keep docs in English.

### `maintenance/freshness-checklist.md`

Checklist for suspicious or touched docs:

- Does this doc still name the correct source files?
- Does it match current TypeScript/Rust shapes?
- Does it match current command names and payload keys?
- Does it match current test commands?
- Does it describe current behavior, not desired future behavior?

### `maintenance/token-budget.md`

Rules for minimizing token usage:

- Always read `README.md` and `task-routes.md`.
- Read only route-specific docs after that.
- Use docs as a map, then verify focused code.
- Do not scan `docs/superpowers` during normal tasks.
- Keep route docs concise enough to be read every task.
- Prefer source links and verification steps over long explanations.

Suggested soft line budgets:

- `README.md`: 120 lines or fewer.
- `task-routes.md`: concise route table plus short route details.
- Domain, architecture, contract, and maintenance files: usually 80-150 lines each.

## Testing And Verification Strategy

Docs should direct agents to focused checks based on blast radius.

Expected check families:

- Frontend test file: `npm test -- <test-file>`
- Frontend typecheck: `npx tsc --noEmit`
- Frontend full tests: `npm test -- --run`
- Frontend build: `npm run build`
- Rust command tests: `cd src-tauri && cargo test --test command_api`
- Rust focused test: `cd src-tauri && cargo test test_name`
- Rust runner tests: `cd src-tauri && cargo test --test runner_spike`
- Rust format: `cd src-tauri && cargo fmt --check`
- Rust lint: `cd src-tauri && cargo clippy --all-targets --all-features`

The docs should not require every check for every task. Routes should choose checks by affected area.

## Error Handling Strategy

The docs should prevent common agent mistakes:

- Changing TypeScript shapes without matching Rust serde shapes.
- Adding commands without updating frontend wrappers and tests.
- Adding action configs without defaults, labels, validation, runner execution, and tests.
- Changing UI layout or styling without reading `DESIGN.md`.
- Treating `docs/superpowers` as current truth.
- Changing runner behavior without considering run state, cancellation, progress, and terminal browser behavior.

These should appear as route-specific checklists, not long narratives.

## Token Budget Strategy

The design intentionally spends a small number of tokens upfront to avoid broad, unfocused code exploration later.

Mandatory reading is limited to:

1. `docs/README.md`
2. `docs/task-routes.md`
3. Only route-specific docs named by the selected route.

Agents should not read the entire `/docs` tree for normal tasks. Multi-area tasks should read only the routes and docs for the touched areas.

## Implementation Notes

This design does not implement the docs. The follow-up implementation plan should:

1. Update `AGENTS.md` with the docs sync requirement.
2. Create the `/docs` structure and files.
3. Populate initial docs from current code, not from old specs.
4. Keep `docs/superpowers` unchanged as an archive.
5. Verify the new docs are concise, current, and route-driven.

## Approval

The user approved:

- English docs.
- Task-based entry with layer references.
- Business/domain docs for hidden coupling.
- Mandatory docs sync enforced through `AGENTS.md`.
- Token-budgeted progressive reading.
