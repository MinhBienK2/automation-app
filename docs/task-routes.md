# Task Routes

Start here after `docs/README.md`. Pick only the route matching the task.

Invariants are split by area under `domain/invariants/`. Read only the relevant sub-file, not the index.

---

### Understand Product Or Plan Broad Work
- **Read**: `domain/product-model.md`, `architecture/overview.md`, `domain/user-visible-invariants.md` (index)

### Add Or Change An Action Type
- **Read**: `domain/action-taxonomy.md`, `domain/cross-feature-impact-map.md`, `architecture/runner.md`, `contracts/action-configs.md`, `contracts/workflow-types.md`
- **Verify**: `src/types/workflow.ts`, `src/lib/actionCapabilities.ts`, action editor components, `electron/backend/actions/`, `electron/backend/graph/compiler.ts`, `electron/backend/runtime/runner.ts`
- **Checks**: `npm test -- src/lib/actionCapabilities.test.ts` / `electron/backend/actions/` / `electron/backend/graph/`

### Add Or Change A Zod Action Schema
- **Read**: `domain/action-taxonomy.md` (deprecation policy), `contracts/action-configs.md` (Zod schema section), `architecture/persistence.md` (quarantine + migration framework)
- **Verify**: `electron/backend/actions/schemas/` (one file per action type + `common.ts` + `index.ts` registry), `electron/backend/actions/registry.ts` (`configSchema`, `deprecated`), `electron/backend/features/workflows/graphLoader.ts` (`processGraphOnLoad` runs Zod validation + quarantine)
- **Checks**: `npm test -- electron/backend/actions/schemas/`, `npx tsc --noEmit` (catches `assertSchemaCoverage()` drift at build time)

### Change Workflow UI Behavior
- **Read**: `domain/workflow-lifecycle.md`, `domain/invariants/workflow-ui.md`, `architecture/frontend.md`; add `contracts/run-state.md` for run/test UI
- **Verify**: `src/app/App.tsx`, `src/features/workflows/state/`, `src/features/workflows/components/`, `src/features/workflows/pages/`, `src/shared/types/workspaceContracts.ts`
- **Checks**: focused page/component tests; `npx tsc --noEmit`

### Change Projects, Browser Profiles, Or Subflows
- **Read**: `domain/product-model.md`, `domain/workflow-lifecycle.md`, `domain/invariants/projects.md`, `architecture/persistence.md`, `contracts/electron-ipc.md`; add `DESIGN.md` for styling
- **Verify**: `src/features/projects/state/`, `src/features/subflows/`, `electron/backend/features/projects/`, `electron/backend/features/workflows/subflowCommands.ts`, `electron/backend/db/`
- **Checks**: `npm test -- electron/backend/db/ electron/backend/features/projects/ electron/backend/graph/`, `npx tsc --noEmit`

### Change User-Facing Styling Or Layout
- **Read**: `DESIGN.md`, `architecture/frontend.md`, `domain/invariants/workflow-ui.md`
- **Verify**: `src/App.css`, `src/styles/`, `src/layouts/`, user-facing components
- **Checks**: `npm test -- src/AppCss.test.ts`; focused UI tests

### Change An Electron IPC Command
- **Read**: `architecture/command-boundary.md`, `contracts/electron-ipc.md`, `contracts/workflow-types.md`
- **Verify**: `src/lib/workflowApi.ts`, `src/types/electron.ts`, `electron/preload.cts`, `electron/ipc.ts`, `electron/main.ts`, `electron/backend/commands.ts`, `electron/backend/features/*/›Commands.ts`
- **Checks**: `npm test -- src/lib/workflowApi.test.ts`, `npx tsc --noEmit`, `npm run build:electron`

### Change Browser Recorder
- **Read**: `domain/product-model.md`, `domain/workflow-lifecycle.md`, `domain/invariants/recording.md`, `contracts/electron-ipc.md`; add `architecture/runner.md` for capture/replay
- **Verify**: `electron/backend/features/recording/`, `src/lib/workflowApi.ts`, `src/types/workflow.ts`, recorder UI under `src/features/workflows/state/useRecordingWorkspace.ts`
- **Checks**: `npm test -- electron/backend/features/recording/` / `src/lib/workflowApi.test.ts`, `npx tsc --noEmit`

### Change Domain Validation
- **Read**: `architecture/domain.md`, `contracts/action-configs.md`, `domain/invariants/runner.md`
- **Verify**: `electron/backend/graph/validateGraph.ts`, `electron/backend/graph/compiler.ts`, `electron/backend/actions/validation.ts`, `electron/backend/features/workflows/workflowCommands.ts`
- **Checks**: `npm test -- electron/backend/graph/`, `npm run build:electron`

### Change SQLite Persistence
- **Read**: `architecture/persistence.md`, `contracts/workflow-types.md`
- **Verify**: `electron/backend/db/`, `electron/backend/config/`, `migrations/`, `electron/backend/features/workflows/`
- **Checks**: `npm test -- electron/backend/db/`, `npm run build:electron`

### Change Workflow Scheduling
- **Read**: `domain/workflow-lifecycle.md`, `domain/invariants/runner.md`, `architecture/persistence.md`, `contracts/electron-ipc.md`
- **Verify**: `src/features/schedules/`, `electron/backend/features/scheduling/`, `electron/backend/commands.ts`, `electron/backend/runtime/runManager.ts`
- **Checks**: `npm test -- electron/backend/features/scheduling/`, `npx tsc --noEmit`

### Change Operations Overview
- **Read**: `domain/product-model.md`, `domain/invariants/workflow-ui.md`, `architecture/frontend.md`, `contracts/electron-ipc.md`
- **Verify**: `src/features/overview/`, `src/features/settings/`, `electron/backend/features/operations/`, `electron/backend/diagnostics/`, `electron/backend/features/settings/`
- **Checks**: `npm test -- electron/backend/db/ electron/backend/features/operations/`, `npx tsc --noEmit`

### Change Mission Control Navigation
- **Read**: `domain/product-model.md`, `domain/invariants/workflow-ui.md`, `architecture/frontend.md`; add `DESIGN.md` for layout changes
- **Verify**: `src/app/App.tsx`, `src/app/useAppNavigation.ts`, `src/layouts/`, `src/features/*/`
- **Checks**: `npm test -- src/layouts/AppShell.test.tsx`, `npx tsc --noEmit`

### Change Evidence Explorer
- **Read**: `domain/invariants/runner.md`, `architecture/frontend.md`, `architecture/persistence.md`, `contracts/electron-ipc.md`
- **Verify**: `src/features/evidence/`, `electron/backend/features/evidence/`, `electron/backend/features/settings/`
- **Checks**: `npm test -- electron/backend/commands.test.ts src/lib/workflowApi.test.ts`, `npx tsc --noEmit`

### Change Sign-In Or Session Auth
- **Read**: `architecture/command-boundary.md`, `contracts/electron-ipc.md`; add `DESIGN.md` for the sign-in screen
- **Verify**: `src/features/auth/`, `electron/backend/features/auth/`
- **Checks**: `npm test -- electron/backend/features/auth/`, `npx tsc --noEmit`

### Change Identity Lab
- **Read**: `domain/invariants/runner.md`, `architecture/frontend.md`, `architecture/command-boundary.md`, `contracts/electron-ipc.md`
- **Verify**: `src/features/identities/`, `electron/backend/features/identities/`
- **Checks**: `npm test -- electron/backend/commands.test.ts src/lib/workflowApi.test.ts`, `npx tsc --noEmit`

### Change Runner Behavior
- **Read**: `domain/execution-semantics.md`, `domain/cross-feature-impact-map.md`, `architecture/runner.md`, `contracts/run-state.md`
- **Verify**: `electron/backend/runtime/runner.ts`, `electron/backend/browser/sessionManager.ts`, `electron/backend/runtime/runManager.ts`, `electron/backend/graph/compiler.ts`
- **Checks**: focused runner/compiler tests, `npm run build:electron`; `npm run test:fingerprint` for identity evidence; `npm run test:smoke` for CloakBrowser smoke

### Change Run Status Or Monitoring
- **Read**: `domain/execution-semantics.md`, `architecture/frontend.md`, `contracts/run-state.md`
- **Verify**: `src/features/workflows/components/RunStatusBar.tsx`, `RunIssuePanel.tsx`, `RunMonitorDrawer.tsx`, `src/features/runs/`, `src/lib/workflowUi.ts`, `electron/backend/runtime/runManager.ts`
- **Checks**: `npm test -- src/features/workflows/pages/`, `npm test -- electron/backend/commands.test.ts`

### Work On Desktop Automation (Desktop Surface)
- **Read**: `adr/0001-desktop-execution-surface.md` first — it fixes the seam between the web and desktop run flows. Then `architecture/desktop-runner.md`, plus the `domain/desktop/` file for the area: `capability-tiers.md`, `locator-model.md`, `desktop-target.md`, `action-family.md`, `secrets-and-evidence.md`, `evidence-model.md`, `scheduling.md`
- **Verify**: `electron/backend/surfaces/desktop/`, `electron/backend/actions/schemas/desktop/`, `electron/backend/runtime/surface.ts`
- **Background**: `research/cua-driver-windows.md` holds the measured driver behaviour. Read it before trusting any `cua-driver` documentation — several documented behaviours did not hold on Windows.
- **Checks**: focused desktop surface tests, `npx tsc --noEmit`, `npm run build:electron`
- **Do not**: make the desktop driver implement `BrowserDriver*` types — ADR-0001 forbids it, with reasons.

### Fix A Bug
- **Read**: route for the affected area; `domain/cross-feature-impact-map.md` if cross-layer
- **Checks**: add the smallest focused failing test first, then run affected route checks.

### Refactor A Module
- **Read**: architecture doc for the module, relevant invariant sub-file
- **Checks**: existing tests, `npm test -- ci-cd.test.ts` for backend layout

### Update Tests Only
- **Read**: `architecture/testing.md` and the route for the behavior under test.
- **Checks**: focused test command for the edited test.

### Change Desktop Packaging Or CI/CD
- **Read**: `architecture/overview.md`, `architecture/testing.md`
- **Verify**: `package.json`, `.github/`, `README.md`, `docs/release-governance.md`
- **Checks**: `npm test -- ci-cd.test.ts`, `npm run build`, `npm run electron:pack`
- **E2E commands**: `test:e2e:smoke`, `test:e2e:full`, `test:e2e:visible`, `test:e2e:flake`, `test:e2e:real-web`

