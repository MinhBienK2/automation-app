# Electron CloakBrowser Migration Design

## Context

The current application is a React and Tauri desktop app. The frontend owns the
workflow list, graph editor, Workflow Settings, run status display, import and
export flows, and UI tests. The backend is Rust: Tauri commands validate and
persist workflows in SQLite, compile visual graphs, start background runs, retain
browser sessions, and execute actions through a custom `chromiumoxide` runner.

The team wants the product to use CloakBrowser and Playwright instead of
maintaining custom browser identity and human-like execution code. CloakBrowser
currently fits Node.js and Python directly, and its JavaScript package exposes a
Playwright-compatible API through `launch`, `launchContext`, and
`launchPersistentContext`. The app must remain an installable desktop app.

## Decisions

- Migrate to an Electron desktop app, Linux first.
- Preserve the existing React workflow UI as much as possible.
- Remove Tauri and Rust from the production runtime.
- Use the npm package `cloakbrowser` with `playwright-core`.
- Enable CloakBrowser `humanize` by default for every workflow run.
- Reset the local data format instead of migrating the current Rust SQLite
  migrations.
- Keep SQLite as the local storage engine in the new Electron/Node backend.
- Target full workflow execution parity with the current product, not a reduced
  MVP.

## Architecture

The target architecture is:

```text
React renderer
  -> workflow UI, graph editor, settings, run state views
  -> src/lib/workflowApi.ts rewritten from Tauri invoke to typed Electron IPC

Electron preload
  -> exposes a narrow window.workflowApi bridge
  -> keeps direct Node access out of the renderer

Electron main
  -> app lifecycle, app data paths, menus, packaging hooks
  -> registers IPC command handlers

Node/TypeScript backend
  -> command handlers matching current frontend intent
  -> SQLite repository with a new schema
  -> workflow graph compiler and validation ported from Rust
  -> run service, cancellation, polling state, retained sessions

CloakBrowser runner
  -> npm cloakbrowser plus playwright-core
  -> launchPersistentContext for named browser profiles
  -> launchContext for temporary runs
  -> humanize enabled by default
```

The renderer must not import Playwright, CloakBrowser, filesystem APIs, or raw
Node modules. It calls a typed IPC bridge exposed by Electron preload. The Node
backend owns database access, workflow command handling, browser execution,
outputs, evidence, run cancellation, and retained session lifecycle.

`src-tauri/` remains available only as a temporary reference while behavior is
ported. After full parity gates pass, it can be removed along with Tauri
dependencies, scripts, command docs, and Rust-specific verification steps.

## Storage

The new app data layout should be:

```text
appData/
  automation-app/
    database.sqlite
    browser-profiles/
    evidence/
    downloads/
    screenshots/
```

The initial SQLite schema should prefer document-shaped workflow data and
queryable run history:

```text
workflows
  id
  name
  description
  tags_json
  graph_json
  settings_json
  created_at
  updated_at

runs
  id
  workflow_id
  status
  started_at
  finished_at
  settings_snapshot_json
  graph_snapshot_json
  outputs_json
  error_json

run_steps
  id
  run_id
  node_id
  step_number
  action_type
  status
  started_at
  finished_at
  trace_json
  error_json
```

`graph_json` and `settings_json` stay as JSON documents because the UI already
works with graph and settings objects. SQLite remains useful for workflow lists,
run history, status queries, evidence indexing, and future audit queries.

The new Workflow Settings model should keep the same product concepts: General,
Execution, Browser, Environment, Variables, Triggers, and Advanced. Triggers
remain metadata only until a scheduler is explicitly designed.

Import and export can use a new package format containing workflow metadata,
graph, settings, and optional evidence metadata. The first migration does not
need to import old Tauri/Rust packages.

## Runner

The runner is a TypeScript service in the Electron main or a dedicated Node
worker process. It receives an executable plan from the graph compiler and
dispatches actions using Playwright APIs against a CloakBrowser context.

Run flow:

```text
run command
  -> load workflow and settings
  -> validate graph and settings
  -> compile graph to executable action configs
  -> apply settings defaults
  -> create run row
  -> launch CloakBrowser context
  -> execute steps with cancellation checks
  -> update run state and run_steps traces
  -> capture outputs and evidence
  -> retain or close browser by policy
```

Browser launch maps settings to CloakBrowser:

```ts
launchPersistentContext({
  userDataDir,
  headless,
  proxy,
  userAgent,
  viewport,
  humanize: true,
  contextOptions: {
    geolocation,
    permissions,
    extraHTTPHeaders,
    storageState,
  },
});
```

When a workflow has `profile_name`, the runner uses
`launchPersistentContext()` with `browser-profiles/<profile>`. Without a named
profile, it uses a temporary context and cleans it up after the run unless the
retention policy keeps the browser open.

The runner should not recreate custom human-like behavior. Browser identity and
humanized input behavior belong to CloakBrowser. Existing settings such as
`interaction_fidelity`, `timing_profile`, and `direct_dom_fallback` should be
handled as compatibility fields or mapped only where needed to preserve current
action semantics.

## Full Parity Scope

The migration is complete only when current user-visible workflow execution
behavior is preserved through the Electron/Node runner.

Action and semantics groups to port:

- navigation, tabs, frames, dialogs, downloads
- pointer, input, form, keyboard, clipboard, scroll
- wait, assert, extract, screenshot, outputs
- variables, templates, transforms
- cookies, localStorage, sessionStorage, headers, permissions, geolocation
- request and response waits, request blocking, response mocking where
  Playwright supports the behavior
- graph control flow: if, switch, loops, retry, try/catch, fallback,
  break/continue, subworkflow, domain allowlist, stop workflow
- fingerprint preflight gate and sanitized evidence output
- batch run behavior, including stop-on-first-failed-row and the existing
  concurrency guard until row isolation is designed
- run state fields used by the UI: current node, completed nodes, failed node,
  terminal status, outputs, and command-facing error shape

## IPC Contract

`src/lib/workflowApi.ts` should remain the renderer's API entry point. It should
call the Electron bridge instead of Tauri `invoke`.

Representative bridge surface:

```ts
window.workflowApi.listWorkflows();
window.workflowApi.createWorkflow(input);
window.workflowApi.getWorkflow(id);
window.workflowApi.saveWorkflowSettings(id, settings);
window.workflowApi.getWorkflowGraph(id);
window.workflowApi.saveWorkflowGraph(id, graph);
window.workflowApi.validateWorkflowRun(id);
window.workflowApi.runWorkflow(id);
window.workflowApi.stopRun();
window.workflowApi.getRunState();
window.workflowApi.exportWorkflowPackage(id, options);
window.workflowApi.importWorkflowPackage(filePath);
```

Electron preload exposes the bridge through `contextBridge`. The renderer keeps
`nodeIntegration` disabled. Electron main registers handlers and forwards work to
backend services. Command errors keep the existing serializable shape:

```ts
{ message: string; field?: string }
```

Native dialogs and filesystem access move from Tauri plugins to Electron APIs.
The app data directory comes from Electron `app.getPath("userData")`.

## Migration Phases

### Phase 1: Electron shell and IPC foundation

- Add Electron main and preload entry points.
- Load the existing React renderer in Electron.
- Replace Tauri invoke usage with typed Electron IPC in `workflowApi.ts`.
- Initialize the new SQLite database in Electron app data.
- Package a Linux build.

### Phase 2: Domain, storage, and command parity

- Port workflow CRUD.
- Port Workflow Settings save/load/validation.
- Port graph save/load/validation command handlers.
- Port import/export to the new package format.
- Preserve command-facing error shape.

### Phase 3: Graph compiler parity

- Port graph validation and compiler from Rust to TypeScript.
- Use fixtures to compare compiled executable plans for representative current
  graphs.
- Preserve current graph control-flow semantics.

### Phase 4: CloakBrowser runner parity

- Implement CloakBrowser context launch.
- Implement action dispatch with Playwright.
- Enable `humanize: true` by default.
- Implement profile, proxy, viewport, user agent, headless, downloads,
  screenshots, outputs, cancellation, retained sessions, and fingerprint
  preflight.

### Phase 5: Run state, evidence, and batch parity

- Persist run and run step traces.
- Keep UI polling and canvas node status behavior.
- Capture outputs and evidence into run state and SQLite.
- Port batch execution behavior and current concurrency guard.

### Phase 6: Remove Tauri and Rust

- Delete production Tauri/Rust runtime after parity gates pass.
- Remove Tauri dependencies and scripts.
- Update docs, README, smoke checklist, and agent command references.

## Test Strategy

- Unit tests for TypeScript domain validation, graph compiler, and settings
  defaults.
- Repository tests against a temporary SQLite database.
- IPC handler tests for command payloads and errors.
- Runner integration tests against local fixture pages.
- CloakBrowser launch smoke tests for context creation, profile persistence,
  `humanize`, and launch option mapping.
- UI tests updated to mock the Electron bridge instead of Tauri.
- Packaged Linux app smoke checklist.

Tests must avoid depending on production systems. Production and staging targets
remain manually operated, allowlisted, and evidence-producing environments.

## Documentation Updates During Implementation

Implementation should update current docs as the runtime changes:

- `docs/architecture/overview.md`
- `docs/architecture/runner.md`
- `docs/architecture/command-boundary.md`
- `docs/architecture/persistence.md`
- `docs/contracts/tauri-commands.md`, likely renamed to an Electron IPC
  contract
- `docs/contracts/run-state.md`
- `docs/contracts/workflow-types.md`
- `docs/domain/product-model.md`
- `docs/domain/execution-semantics.md`
- `docs/task-routes.md`
- `README.md`
- agent command references in `AGENTS.md`

The docs should continue to describe authorized, owned-system testing, domain
allowlists, named test accounts, explicit operator controls, and evidence
outputs. CloakBrowser integration should be documented as a controlled internal
testing runtime, not as general third-party bypass tooling.

## Acceptance Criteria

- The app builds and packages as an Electron desktop app for Linux.
- Existing React workflow UI remains recognizable and usable.
- Tauri/Rust is not required at runtime.
- Workflows, settings, graphs, run state, import/export, and batch behavior reach
  full current parity.
- CloakBrowser and Playwright execute browser actions through Node/TypeScript.
- `humanize` is enabled by default for runs.
- Named profiles persist login/session state in Electron app data.
- Temporary runs clean up temporary state unless retention keeps the browser open.
- Outputs, failure screenshots, fingerprint preflight evidence, and action traces
  remain available after runs.
- Focused automated tests and a packaged Linux smoke test pass.
