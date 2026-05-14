# Agent Instructions

## Product Purpose
- This repo is an internal adversarial browser automation lab for authorized testing of company-owned production and staging systems.
- The product's explicit goal is to make automated workflows pass through the company's existing production defenses in controlled owned environments, then produce evidence that helps security, trust, anti-abuse, and production teams find detection gaps and harden defenses.
- Treat bypass-like work as authorized red-team simulation against owned systems: realistic browser identities, account state, network posture, timing, interaction behavior, session continuity, content patterns, and run evidence are product requirements.
- Model real abuse-defense surfaces: fake engagement, account integrity, network reputation, device/browser fingerprinting, behavioral analytics, velocity/rate limits, graph-based detection, content/spam detection, risk scoring, challenge/friction flows, API abuse, and coordinated bot taxonomies.
- Keep scope bounded to owned or explicitly authorized targets. Sensitive automation must preserve auditability through domain allowlists, named test accounts, reproducible browser identity settings, clear run outputs, and explicit operator controls.

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
Before code changes, agents MUST read only the relevant files under `docs/`.

Flow: read `docs/README.md`, route through `docs/task-routes.md`, follow `docs/agent-workflow.md`, then inspect listed source files.

Exceptions: formatting-only changes, comment-only changes, generated files, dependency lockfile churn with no behavior or command changes, and throwaway prototypes. If skipping docs updates for a code change, state why in the final response.

Final responses for code changes MUST include tests/checks run, whether `docs/` was updated, and why docs did not need updates if unchanged.

## Design System Requirement
Before changing `src/App.css`, layout structure, or user-facing component styling, agents MUST read `DESIGN.md` and follow its design system for colors, typography, spacing, borders, radius, responsive behavior, and component treatment.

Preserve the existing Supabase-inspired dark theme unless the user explicitly requests a different visual direction. For UI changes, final summaries should mention whether `DESIGN.md` was consulted and call out any intentional deviations.

## Project Structure
- Frontend UI lives in `src/App.tsx`, `src/App.css`, `src/layouts/`, and `src/features/workflows/`; tests use Vitest and Testing Library next to feature, layout, lib, and CSS files.
- Electron IPC lives in `electron/ipc.ts`, `electron/preload.cts`, `electron/main.ts`, and typed wrappers in `src/lib/workflowApi.ts`.
- Electron backend commands, SQLite persistence, graph compiler, and CloakBrowser runner live under `electron/backend/`.
- Agent source-of-truth docs live under `docs/`; historical plans/specs live under `docs/superpowers/`; smoke checklist lives in `README.md`.

## Key Conventions
- Add or update focused tests when changing validation, commands, persistence, runner behavior, or user-visible workflow UI.
- Prefer existing action config variants and command names; update TypeScript DTOs and Electron backend handlers together when adding an action.
- Keep the desktop smoke checklist in `README.md` accurate when workflow behavior changes.

## Commit Attribution
AI-authored commits MUST include a `Co-Authored-By: <agent name> <email>` trailer.
