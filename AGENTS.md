# Agent Instructions

## Package Manager
- Use **npm** for the frontend: `npm install`, `npm run tauri dev`, `npm run build`, `npm test`
- Use **cargo** inside `src-tauri/`: `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets --all-features`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Frontend test file | `npm test -- src/App.test.tsx` |
| Typecheck frontend | `npx tsc --noEmit` |
| Rust test file | `cd src-tauri && cargo test --test command_api` |
| Rust single test | `cd src-tauri && cargo test test_name` |
| Rust format check | `cd src-tauri && cargo fmt --check` |

## Project Structure
- Frontend UI lives in `src/App.tsx` and `src/App.css`; tests use Vitest and Testing Library in `src/App.test.tsx`.
- Tauri commands live in `src-tauri/src/commands.rs`; keep command-facing errors serializable through `CommandError`.
- Domain validation belongs in `src-tauri/src/domain/`; persistence belongs in `src-tauri/src/repositories/` and SQL migrations.
- Browser execution code belongs in `src-tauri/src/runner/`; preserve stop/run state behavior when changing runner flow.
- MVP plans and smoke checklist live under `docs/superpowers/` and `README.md`.
- Design direction lives in `DESIGN.md`; reference it for visual styling, layout, typography, and component UI work.

## Key Conventions
- Keep Rust domain types `Serialize`/`Deserialize` compatible with the TypeScript shapes used by Tauri `invoke`.
- Add or update focused tests when changing validation, commands, persistence, runner behavior, or user-visible workflow UI.
- Prefer existing action config variants and command names; update both Rust and TypeScript types when adding an action.
- Read `DESIGN.md` before changing `src/App.css`, layout structure, or user-facing component styling.
- Keep the desktop smoke checklist in `README.md` accurate when workflow behavior changes.

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent's name and attribution byline)
```
Example: `Co-Authored-By: Codex <noreply@example.com>`
