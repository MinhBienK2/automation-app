# Product Model

## Purpose

Mission Control is an Electron desktop app for building and running browser automation workflows against company-owned systems.

## Core Concepts

| Concept | Definition |
|---------|-----------|
| **Project** | Groups workflows, subflows, and browser profiles. Default: `Main`. |
| **Browser Profile** | Project-owned identity + persistent storage. Creates `identity_id`, `fingerprint_seed`, `profile_dir`. DTO: `project_environments`. |
| **Workflow** | Named automation with a visual graph as authoring source. |
| **Subflow** | Reusable non-runnable graph fragment inside one project. Called via `call_subflow`. |
| **Action Config** | Executable behavior produced by graph compilation. |
| **Run** | Compiled graph execution via CloakBrowser runner. |
| **Schedule** | In-app trigger for saved workflow (runs only while app is open). |
| **Outputs** | Named values captured during execution (text, paths, variables). |
| **Graph** | Versioned visual model: nodes, edges, ports, viewport, action configs. |
| **Compiled Graph** | Generated executable plan from graph → action configs + domain policy. |
| **Recording Session** | Backend-owned draft: captures browser usage → reviewable steps → saved workflow. |

## Workspace Navigation

Sidebar order: **Overview** → **Projects** → **Evidence** → **Schedules** → **Identities** → **Setting** (collapsible: General, Help)

- **Overview**: default screen. Metrics, live runs, attention, activity, recent evidence, upcoming schedules.
- **Projects**: project-scoped authoring. Fixed tabs: Workflows, Subflows, Settings.
- **Evidence**: persisted run evidence browser (screenshots, downloads, identity, traces, manifests).
- **Schedules**: cross-workflow schedule CRUD and event history.
- **Identities**: managed browser identity posture, diagnostics, retained-session close, historical refs.
- **Setting**: collapsible navigation group:
  - **General**: autosave, diagnostics, environment readiness, maintenance.
  - **Help**: XPath cookbook, graph shortcuts.

## Workflow Settings

Per-workflow config aggregate with sections:
- **General**: name, description, tags, notes.
- **Run Policy**: max duration, browser retention, Allow Run JavaScript, Run from selected, batch defaults.
- **Browser Launch**: selects one project browser profile (no identity/proxy/humanize editing).
- **Graph**: default link wait, Live Run toggle, Follow current.
- **Environment**: initial variable rows.

## Key Source Files

See `docs/architecture/overview.md` for the full layer map. Quick reference:

| Layer | Key Entry Points |
|-------|-----------------|
| Frontend | `src/App.tsx`, `src/features/*/`, `src/lib/workflowApi.ts` |
| Types | `src/types/workflow.ts` (barrel) |
| Bridge | `electron/preload.cts`, `electron/ipc.ts` |
| Commands | `electron/backend/commands.ts` |
| Runner | `electron/backend/runtime/runner.ts`, `runManager.ts` |
| Compiler | `electron/backend/graph/compiler.ts`, `validateGraph.ts` |
| Persistence | `electron/backend/persistence/workflowRepository.ts` |
| Sessions | `electron/backend/browser/sessionManager.ts` |
| Recording | `electron/backend/recording/recorderSessionManager.ts` |
| Settings | `electron/backend/services/workflowSettingsService.ts` |

## Invariant

The product model is defined by current code. If this doc and code disagree during a task, update this doc for the touched area.
