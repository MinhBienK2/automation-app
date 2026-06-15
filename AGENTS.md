# Agent Instructions

## Product Purpose
- Adversarial browser automation lab simulating realistic client bypasses (fingerprints, behavior, timing) on company-owned systems.
- Helps identify abuse detection gaps (fake engagement, rate limits) via auditable test runs (allowlists, test accounts).

## Package Manager
- Use **npm**: `rtk npm install`, `npm run electron:dev`, `rtk npm run build`, `rtk npm test`, `npm run electron:pack`

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

## File-Scoped Commands
| Task | Command |
|------|---------|
| Test file | `rtk npm test -- path/to/file.test.ts[x]` |
| Typecheck renderer | `rtk npx tsc --noEmit` |

## TDD Requirement
Before implementing any feature, bug fix, refactor, or behavior change, agents MUST use `.agents/skills/test-driven-development`.

Exceptions: docs-only changes, formatting-only changes, comment-only changes, generated code, trivial configuration updates, and throwaway prototypes. If skipping TDD for a code change, state why in the final response.

## Docs Sync Requirement
Before code changes, agents MUST read `docs/README.md` and follow its execution loop. That file is the single source of truth for the reading path, final-response checklist, update rules, and conflict resolution.

Exceptions: formatting-only changes, comment-only changes, generated files, dependency lockfile churn with no behavior or command changes, and throwaway prototypes. If skipping, state why in the final response.

## Design System Requirement
Before changing `src/App.css`, layout structure, or user-facing component styling, agents MUST read `DESIGN.md` and follow its design system for colors, typography, spacing, borders, radius, responsive behavior, and component treatment.

Preserve the existing Supabase-inspired dark theme unless the user explicitly requests a different visual direction. For UI changes, final summaries should mention whether `DESIGN.md` was consulted and call out any intentional deviations.

## Project Structure
- Frontend composition root is `src/app/App.tsx`. Feature code: `src/features/{feature-name}/{state,components,pages,data,lib}/`.
- Electron IPC lives in `electron/ipc.ts`, preload in `electron/preload.cts`, and backend commands in `electron/backend/commands/{domain}Commands.ts`.
- Database persistence, graph compiler, and runner live under `electron/backend/`.
- Docs live under `docs/`; router is `docs/task-routes.md`.

## File Size Limits (Enforced by ESLint)
- Source files: max 300 lines (excluding blank lines and comments). Tests and pure data are exempt.
- Split files before they exceed 300 lines. Run `npm run lint`.

## Do NOT
- Read all docs by default — use `docs/task-routes.md` as the router.
- Add state or business logic to `src/app/App.tsx` (only hook composition & routing).
- Duplicate TypeScript type shapes or command names into docs prose.
- Rewrite existing graph links or edge waits when changing defaults.

## Key Conventions
- Quick Reference Map: `docs/ARCHITECTURE_QUICK_REF.md`. Read it to find hooks and commands instantly.
- Layer map: `docs/architecture/overview.md`. Read it for broad or unclear tasks.
- Add/update tests when changing validation, commands, persistence, runner, or UI.
- During development and TDD, run focused tests using file-scoped commands to keep feedback fast.
- Before completing any task, you MUST run the FULL test suite using `rtk npm run test` to verify there are no regressions, in addition to running `rtk npm run lint` and `rtk npm run build`.
