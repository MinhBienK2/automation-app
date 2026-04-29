# Agent Instructions

## Package Manager
- Use **npm** for the frontend: `npm install`, `npm run tauri dev`, `npm run build`, `npm test`
- Use **cargo** inside `src-tauri/`: `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets --all-features`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Frontend test file | `npm test -- path/to/file.test.tsx` |
| Typecheck frontend | `npx tsc --noEmit` |
| Rust test file | `cd src-tauri && cargo test --test command_api` |
| Rust single test | `cd src-tauri && cargo test test_name` |
| Rust format check | `cd src-tauri && cargo fmt --check` |

## TDD Requirement
Before implementing any feature, bug fix, refactor, or behavior change, agents MUST use `.agents/skills/test-driven-development`.

Expected flow:
1. Add or update a focused failing test first.
2. Run the relevant test and confirm it fails for the expected reason.
3. Implement the smallest change needed.
4. Re-run the focused test and relevant checks.

Exceptions: docs-only changes, formatting-only changes, comment-only changes, generated code, trivial configuration updates, and throwaway prototypes. If skipping TDD for a code change, state why in the final response.

## Docs Sync Requirement
Before implementing any feature, bug fix, refactor, behavior change, command/API change, validation change, persistence change, runner change, or user-visible workflow change, agents MUST read the relevant files under `docs/`.

Expected flow:
1. Read `docs/README.md` and `docs/task-routes.md`.
2. Read the route-specific domain, architecture, contract, and maintenance docs named by the route.
3. Inspect the current source files listed by the route before assuming docs are complete.
4. Update `docs/` in the same change if behavior, contracts, business rules, task routing, verification expectations, file ownership, or cross-feature impact changed.
5. Before final response, verify docs and code agree for the touched area.

Exceptions: formatting-only changes, comment-only changes, generated files, dependency lockfile churn with no behavior or command changes, and throwaway prototypes. If skipping docs updates for a code change, state why in the final response.

Final responses for code changes MUST include tests/checks run, whether `docs/` was updated, and why docs did not need updates if unchanged.

## Design System Requirement
Before changing `src/App.css`, layout structure, or user-facing component styling, agents MUST read `DESIGN.md` and follow its design system for colors, typography, spacing, borders, radius, responsive behavior, and component treatment.

Preserve the existing Supabase-inspired dark theme unless the user explicitly requests a different visual direction. For UI changes, final summaries should mention whether `DESIGN.md` was consulted and call out any intentional deviations.

## Project Structure
- Frontend UI lives in `src/App.tsx`, `src/App.css`, `src/layouts/`, and `src/features/workflows/`; tests use Vitest and Testing Library next to feature, layout, lib, and CSS files.
- Tauri commands live in `src-tauri/src/commands.rs`; keep command-facing errors serializable through `CommandError`.
- Domain validation belongs in `src-tauri/src/domain/`; persistence belongs in `src-tauri/src/repositories/` and SQL migrations.
- Browser execution code belongs in `src-tauri/src/runner/`; preserve stop/run state behavior when changing runner flow.
- Agent source-of-truth docs live under `docs/`; historical plans/specs live under `docs/superpowers/`; smoke checklist lives in `README.md`.
- Design direction lives in `DESIGN.md`; reference it for visual styling, layout, typography, and component UI work.

## Key Conventions
- Keep Rust domain types `Serialize`/`Deserialize` compatible with the TypeScript shapes used by Tauri `invoke`.
- Add or update focused tests when changing validation, commands, persistence, runner behavior, or user-visible workflow UI.
- Prefer existing action config variants and command names; update both Rust and TypeScript types when adding an action.
- Keep the desktop smoke checklist in `README.md` accurate when workflow behavior changes.

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent's name and attribution byline)
```
Example: `Co-Authored-By: Codex <noreply@example.com>`
