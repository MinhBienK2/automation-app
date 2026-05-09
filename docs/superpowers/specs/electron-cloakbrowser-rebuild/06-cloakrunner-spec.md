# CloakRunner Spec

## Purpose

Define the Node runner process that executes compiled workflow plans through
Playwright and CloakBrowser official APIs.

The runner is the core reason for rebuilding on Electron/Node. It must be
Playwright/CloakBrowser-native, observable, cancellable, and isolated from the
renderer.

## In Scope

- Runner process protocol.
- Browser/context/page lifecycle.
- Run plan execution.
- Action execution ownership.
- Cancellation, timeout, retry, and concurrency.
- Artifact creation.
- Event emission.
- Runner health and crash behavior.

## Out Of Scope

- Renderer UI.
- SQLite writes from runner.
- Old Rust runner compatibility.
- Remote backend deployment.
- Packaging details beyond runner runtime assumptions.

## Product Concepts

The runner consumes:

- compiled run plan;
- run profile snapshot;
- identity profile snapshot;
- environment snapshot;
- artifact output paths;
- operator policy constraints.

The runner emits:

- run events;
- action traces;
- issues;
- artifact metadata;
- terminal outcome.

## Technical Design

### Runner Process

The runner is a local process supervised by Electron main. It may be spawned as
a child Node process or bundled executable. It must expose a versioned JSON
protocol over stdio, IPC, or a local pipe. Main is the only caller.

### Startup

Runner startup sequence:

```text
main starts runner
  -> runner sends ready with protocol version
  -> main sends health check
  -> runner responds ok with capabilities
```

Capabilities include supported action types, browser engine versions, trace
support, and platform details.

### Run Execution Flow

```text
startRun
  -> validate protocol payload
  -> resolve identity snapshot
  -> launch CloakBrowser through Playwright
  -> create browser context/profile
  -> apply environment setup
  -> optional fingerprint preflight
  -> execute compiled plan
  -> emit events and artifacts
  -> close or retain browser according to policy
  -> emit terminal event
```

### Browser Lifecycle

Identity profile controls:

- engine: CloakBrowser;
- persistent profile path;
- headed/headless policy;
- viewport/device options;
- locale/timezone/geolocation;
- proxy binding;
- profile reuse behavior.

The runner must keep browser/context/page references scoped to a run. Retained
sessions need explicit ownership and cleanup rules.

### Action Execution

Runner maps action configs to Playwright/CloakBrowser calls. It should prefer
Playwright locators and semantic actions. Direct JavaScript is allowed only for
explicit advanced actions or read/capture helpers and must be traced.

### Cancellation

Cancellation must support:

- cooperative cancellation between actions;
- action timeout cancellation;
- run-level max duration;
- forceful browser/process cleanup if cooperative stop fails.

Runner must emit a terminal cancellation/stopped event exactly once.

### Retry And Timeout

Run Profile supplies defaults. Action config can override safe per-action
timeout/retry values. Retries must emit attempt events or trace metadata so
failures are debuggable.

### Concurrency

Default concurrency should be conservative. Multiple concurrent runs require
profile isolation, artifact isolation, and resource limits. M1/M2 can support
one active run if the parity matrix allows it.

### Artifacts

Runner writes artifacts into paths allocated by main. Runner emits artifact
metadata; main persists it.

Artifact types:

- screenshot;
- download;
- trace;
- video when enabled;
- log excerpt;
- preflight verdict;
- evidence export payload.

## Interfaces / Contracts

### Commands From Main

- `healthCheck`
- `startRun`
- `cancelRun`
- `shutdown`

### Events To Main

- `runner.ready`
- `run.started`
- `environment.applied`
- `preflight.started`
- `preflight.completed`
- `step.started`
- `step.completed`
- `step.failed`
- `artifact.created`
- `issue.created`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `runner.error`

### Start Run Payload

Minimum fields:

- protocol version;
- run id;
- workflow id;
- run plan;
- run profile snapshot;
- identity profile snapshot;
- environment snapshot;
- artifact directories;
- operator policy snapshot.

## Data Model

Runner does not own durable database schema. It owns in-memory run state and
event payload schemas.

Event payloads must be serializable JSON and stable enough for storage.

## Error Handling

- Payload validation failure rejects `startRun`.
- Browser launch failure emits startup/system failure.
- Identity/profile failure emits policy or validation failure.
- Action failure emits `step.failed` and terminal failure unless graph control
  semantics handle it.
- Runner crash is handled by main; runner should still try to emit terminal
  failure for recoverable errors.

## Security / Safety / Audit

- Runner enforces domain allowlist on navigation and page-changing actions.
- Runner does not log raw proxy passwords or secrets.
- Runner emits actual action mode and locator summary.
- Runner preserves evidence needed to reproduce authorized tests.
- Runner does not implement automated challenge solving.

## Testing

Tests must cover:

- protocol validation;
- health check;
- no-op run;
- navigate/fill/click/wait vertical slice;
- cancellation;
- browser launch failure;
- artifact creation;
- action timeout;
- domain allowlist block;
- runner crash handling from main-process tests.

## Acceptance Criteria

- Runner process can be spawned and health-checked.
- Runner can execute a P0 vertical slice through CloakBrowser/Playwright.
- Runner emits structured events in deterministic sequence.
- Cancellation and timeout create one terminal event.
- Artifacts are written only to approved run directories.
- Runner never requires renderer access.

## Dependencies

- Product Model Spec.
- Electron App Architecture Spec.
- Data And Storage Spec.
- Action Catalog And Locator Spec.
- Identity Profile And Fingerprint Preflight Spec.
- Run Evidence And Audit Spec.

## Open Questions

None blocking. Exact protocol transport is an implementation planning decision
as long as main remains the sole supervisor.
