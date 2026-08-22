# Context

Adversarial browser automation lab simulating realistic client bypasses on company-owned systems. Frontend composition root: `src/app/App.tsx`; Electron backend composition root: `electron/backend/features/index.ts`. Repo conventions and verification commands live in `AGENTS.md`.

## Glossary

**Action family** — one of seven groupings covering all 188 registered action types (`backend/actions/registry.ts`): `interaction`, `navigation`, `extraction`, `variables`, `flow-control`, `environment`, `files`. A family owns its zod schemas and validators under `backend/actions/<family>/` and its executor module at `backend/runtime/executors/<family>.ts`. Family `variables` (pure data, no browser surface) is sub-split by value type: number, text, boolean, list, object.

**Command handlers** — the single map of IPC-invocable backend functions produced by `createWorkflowCommandHandlers`; registered generically in `electron/main.ts`, guarded by the type-level contract in `electron/ipcContract.ts`.

**Evidence** — artifacts and categories recorded during runs; a leaf module at `backend/evidence/` consumed by `runtime/`, `browser/`, and feature code. Nothing may import upward into features from runtime or browser.

**Test support** — shared test fixtures and handler bootstrap living in `backend/testSupport/` (command-level) and `runtime/testSupport/` (executor-local). Tests drive the real command factory over the in-memory SQLite `testDbAdapter`.
