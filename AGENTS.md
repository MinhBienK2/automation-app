# Agent Instructions

## Product Purpose
- Adversarial browser automation lab simulating realistic client bypasses (fingerprints, behavior, timing) on company-owned systems.
- Helps identify abuse detection gaps (fake engagement, rate limits) via auditable test runs (allowlists, test accounts).

## Package Manager
- Use **npm**: `npm install`, `npm run electron:dev`, `npm run build`, `npm test`, `npm run electron:pack`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Test file | `npm test -- path/to/file.test.ts[x]` |
| Typecheck renderer | `npx tsc --noEmit` |
| Build Electron main/preload | `npm run build:electron` |
| Electron package | `npm run electron:pack` |

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
- Frontend UI lives in `src/App.tsx`, `src/App.css`, `src/layouts/`, and `src/features/workflows/`; tests use Vitest and Testing Library next to feature, layout, lib, and CSS files.
- Electron IPC lives in `electron/ipc.ts`, `electron/preload.cts`, `electron/main.ts`, and typed wrappers in `src/lib/workflowApi.ts`.
- Electron backend commands, SQLite persistence, graph compiler, and CloakBrowser runner live under `electron/backend/`.
- Agent source-of-truth docs live under `docs/`; historical plans/specs live under `docs/superpowers/`; smoke checklist lives in `README.md`.

## Do NOT
- Read all docs by default — use `docs/task-routes.md` as the router.
- Duplicate TypeScript type shapes or command names into docs prose.
- Add UI state, SQL, or browser API details to command-boundary docs.
- Rewrite existing graph links or edge waits when changing graph defaults.

## Key Conventions
- Layer map: `docs/architecture/overview.md`. Read it for broad or unclear tasks.
- Add or update focused tests when changing validation, commands, persistence, runner behavior, or user-visible workflow UI.
- Prefer existing action config variants and command names; update TypeScript DTOs and Electron backend handlers together when adding an action.
- Keep the desktop smoke checklist in `README.md` accurate when workflow behavior changes.

## Commit Attribution
AI-authored commits MUST include a `Co-Authored-By: <agent name> <email>` trailer.
