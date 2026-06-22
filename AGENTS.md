# Agent Instructions

## Product Purpose

Adversarial browser automation lab simulating realistic client bypasses (fingerprints, behavior, timing) on company-owned systems. Identifies abuse detection gaps (fake engagement, rate limits) via auditable test runs (allowlists, test accounts).

## Project Structure
- Frontend composition root is `src/app/App.tsx`. Feature code: `src/features/{feature-name}/{state,components,pages,data,lib}/`.
- Electron IPC lives in `electron/ipc.ts`, preload in `electron/preload.cts`, and backend commands in `electron/backend/commands/{domain}Commands.ts`.
- Database persistence, graph compiler, and runner live under `electron/backend/`.
- Docs live under `docs/`; router is `docs/task-routes.md`.

## Rules
- Always prefix shell commands with `rtk` and wait up to 5 minutes instead of polling frequently.
- Use TTD before implementing any feature, bug fix, refactor, or behavior change, MUST use `.agents/skills/test-driven-development`. **Exceptions:** docs-only, formatting-only, comment-only, generated code, trivial config updates, throwaway prototypes.

## File Size Limits
- Each file should not exceed **500 lines**. 
- If the file to be modified is too large, **you need to think about and decide whether or not to split the file.** before coding.

## graphify
Trigger: Architecture understanding, major planning, or very big changes, or if user requests.
Action: Read @.agents/rules/graphify.md for guidance.
Skip: For small, normal change.

## Verification
For small or isolated changes, run only the relevant focused checks
For complex, big changes and high-risk changes. The appropriate component will be run.
- `rtk npm run lint`
- `rtk npm run test` read 30 last lines
- `rtk npm run build` 
 
## After Changes
- Update the relevant `docs/` detail doc only when the change affects contracts or observable behavior. **skip** with request if spec, plan, or verification only.
