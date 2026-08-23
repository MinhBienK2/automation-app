# Agent Instructions

## Product Purpose

Adversarial browser automation lab simulating realistic client bypasses (fingerprints, behavior, timing) on company-owned systems. Identifies abuse detection gaps (fake engagement, rate limits) via auditable test runs (allowlists, test accounts).

## Project Structure
- Frontend composition root is `src/app/App.tsx`. Feature code: `src/features/{feature-name}/{state,components,pages,data,lib}/`.
- Electron IPC: channel map `electron/ipc.ts`, type-level contract `electron/ipcContract.ts`, preload `electron/preload.cts`.
- Backend composition root is `electron/backend/features/index.ts`. Per-domain command factories, repositories, and services live in `electron/backend/features/{domain}/` (e.g. `features/workflows/workflowCommands.ts`).
- Action executors are grouped by action family in `electron/backend/runtime/executors/{family}.ts` (family `variables` sub-split by value type under `executors/variables/`). Validators and zod schemas for the same family live in `electron/backend/actions/{family}/` (schemas under `actions/{family}/schemas/`, public entry `actions/schemas/index.ts`).
- `electron/backend/evidence/` is a leaf module (run artifacts/categories); `runtime/`, `browser/`, and features import it, never the reverse.
- Test support lives in `electron/backend/testSupport/` (command-level fixtures/bootstrap) and `electron/backend/runtime/testSupport/` (executor fixtures). Tests drive the real command factory over the in-memory SQLite `testDbAdapter`.
- Database persistence, graph compiler, and runner live under `electron/backend/`.
- Docs live under `docs/`; router is `docs/task-routes.md`.

## File Size Limits
- Each file should not exceed **500 lines**. 
- If the file to be modified is too large, **you need to think about and decide whether or not to split the file.** before coding.

## graphify
Trigger: Architecture understanding, major planning, or very big changes, or if user requests.
Action: Read @.agents/rules/graphify.md for guidance.
Skip: For small, normal change.

## Verification
For small or isolated changes, run only the relevant focused checks
- `rtk npm run lint [file]`
- `rtk npm run test [file]`
For complex, big changes and high-risk changes. The appropriate component will be run.
- `rtk npm run lint`
- `rtk npm run test` read 30 last lines
- `rtk npm run build` 
 
## After Changes
- Update the relevant `docs/` detail doc only when the change affects contracts or observable behavior. **skip** with request if spec, plan, or verification only.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `MinhBienK2/automation-app`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` at the repo root plus ADRs in `docs/adr/`. See `docs/agents/domain.md`.

# RTK - Rust Token Killer (Google Antigravity)

**Usage**: Token-optimized CLI proxy for shell commands.

## Rule

Always prefix shell commands with `rtk` to minimize token consumption.

Examples:

```bash
rtk git status
rtk cargo test
rtk ls src/
rtk grep "pattern" src/
rtk find "*.rs" .
rtk docker ps
rtk gh pr list
```

## Meta Commands

```bash
rtk gain              # Show token savings
rtk gain --history    # Command history with savings
rtk discover          # Find missed RTK opportunities
rtk proxy <cmd>       # Run raw (no filtering, for debugging)
```
