# Electron App Architecture Spec

## Purpose

Define the process architecture for the Electron/Node rebuild. The architecture
must let the app use Playwright/CloakBrowser directly while keeping the UI
responsive, secure, and isolated from automation side effects.

## In Scope

- Electron main process responsibilities.
- React renderer responsibilities.
- Preload/contextBridge boundary.
- Runner process supervision.
- IPC and event routing.
- App lifecycle and crash behavior.
- Security defaults for local desktop use.

## Out Of Scope

- Detailed UI component design.
- SQLite column definitions.
- Action catalog details.
- CloakBrowser action implementation.
- Packaging installer settings.

## Product Concepts

This spec implements the process boundaries required by Product Model concepts:

- Workspace and storage live behind main-process services.
- Workflow authoring lives in the renderer.
- Runner execution lives in a supervised runner process.
- Run events flow from runner to main to renderer.
- Artifacts are produced by runner and registered through main/storage.

## Technical Design

### Process Layout

```text
Electron Main
  -> AppWindowService
  -> IpcRouter
  -> StorageService
  -> ArtifactService
  -> RunnerSupervisor
  -> PolicyService

Preload
  -> contextBridge exposes typed app API
  -> subscribes renderer to allowed event channels

React Renderer
  -> UI state and rendering
  -> user commands through preload API
  -> no direct filesystem, database, or Playwright access

Runner Process
  -> Playwright/CloakBrowser execution
  -> emits structured run events
  -> writes artifacts through configured artifact paths
```

### Main Process

Main process owns:

- App lifecycle.
- BrowserWindow creation.
- Native dialogs.
- Storage and migration startup.
- IPC command validation and routing.
- Runner process creation, health checks, cancellation, and cleanup.
- Run event persistence.
- Artifact path allocation and metadata registration.
- Workspace-level policy enforcement.

Main process should be small but authoritative. It should not run workflow action
logic directly.

### Preload

Preload exposes a narrow typed API:

- workflow CRUD commands;
- graph save/load/validate/compile commands;
- settings/profile/environment commands;
- run start/stop commands;
- artifact open/export commands;
- event subscriptions.

The renderer must not get raw Node globals.

### Renderer

Renderer owns:

- Workflow list and detail screens.
- Graph builder.
- Settings/profile editors.
- Run monitor and issue display.
- Evidence/artifact viewer.
- Local UI state such as selections, panels, and form drafts.

Renderer treats main IPC as the product API.

### Runner Process

Runner process owns:

- Playwright/CloakBrowser lifecycle.
- Browser context/page/session management.
- Action execution.
- Run cancellation checks.
- Artifact creation.
- Structured event emission.

Runner process communicates through a versioned protocol. It must not mutate the
SQLite database directly. It receives artifact output directories from main and
emits metadata events for main to persist.

### IPC Flow

```text
Renderer command
  -> Preload typed API
  -> Main IpcRouter
  -> service validation
  -> storage or runner supervisor
  -> response

Runner event
  -> RunnerSupervisor
  -> RunEventService persists event
  -> renderer subscription receives event
```

### Crash And Shutdown

Runner crashes must:

- mark active runs as failed with `system` error category;
- persist last received events;
- attempt browser process cleanup;
- notify renderer;
- leave app UI usable.

App shutdown must:

- stop active runs or ask operator when appropriate;
- close database cleanly;
- avoid orphaned runner/browser processes where possible.

## Interfaces / Contracts

IPC commands must be typed and versioned by API namespace:

- `workflow.*`
- `graph.*`
- `settings.*`
- `profile.*`
- `run.*`
- `artifact.*`
- `policy.*`

Runner protocol must be separate from renderer IPC. Main is the only bridge.

Minimum runner protocol messages:

- `runner.healthCheck`
- `runner.startRun`
- `runner.cancelRun`
- `runner.shutdown`
- `event.runStarted`
- `event.stepStarted`
- `event.stepCompleted`
- `event.issueCreated`
- `event.artifactCreated`
- `event.runCompleted`
- `event.runFailed`
- `event.runCancelled`

## Data Model

Architecture does not define tables, but it requires these service boundaries:

- `StorageService` is the only database writer.
- `ArtifactService` owns file paths and retention policy.
- `RunnerSupervisor` owns process handles and runner lifecycle.
- `PolicyService` owns allowlist and operator policy checks before run start.

## Error Handling

Main process maps errors into product error categories:

- Validation errors return to renderer without starting runner.
- Startup errors fail before creating active run execution.
- Runner crashes become system run failures.
- Cancellation returns terminal cancelled/stopped state.
- IPC validation failures never reach runner.

Renderer displays readable messages and keeps technical details in logs or
developer diagnostics.

## Security / Safety / Audit

- `nodeIntegration` must be disabled for renderer windows.
- `contextIsolation` must be enabled.
- Preload must expose only typed, scoped APIs.
- IPC commands must validate payloads in main before using them.
- Runner process must not accept commands from renderer directly.
- External URLs should open through safe native APIs, not arbitrary shell
  execution.
- Domain allowlist checks happen before runner start and again inside runner for
  navigation actions.

## Testing

Test layers:

- Unit tests for IPC payload validation.
- Main-process service tests for runner supervision.
- Renderer tests with mocked preload API.
- Integration tests for start/cancel runner lifecycle.
- Crash simulation test for runner failure.

## Acceptance Criteria

- Electron app can boot with isolated renderer.
- Renderer can call typed IPC commands through preload.
- Main can spawn a runner process and receive health response.
- Runner events are persisted and forwarded to renderer.
- Runner crash does not crash the UI.
- Security defaults prevent renderer direct Node/Playwright access.

## Dependencies

- Product Model Spec.

## Open Questions

None blocking. The implementation plan can decide whether runner is launched by
`child_process.fork`, `spawn`, or a bundled executable as long as the supervision
contract remains the same.
