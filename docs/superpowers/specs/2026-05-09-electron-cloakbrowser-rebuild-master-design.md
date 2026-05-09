# Electron CloakBrowser Rebuild Master Design

## Status

Approved for documentation by the user on 2026-05-09 after brainstorming.

This is a master/program spec. It coordinates the smaller specs needed to rebuild
the app as an Electron/Node product that is native to Playwright and
CloakBrowser. It is not an implementation plan and does not authorize coding by
itself.

## Implementation Progress

Last updated: 2026-05-09.

Overall status: **in progress**. M0 Spec Baseline is complete. M1 Foundation is
implemented and verified as the first rebuild slice. M2 Runner Vertical Slice is
partially implemented. M3-M6 are not complete.

Progress terms:

- `SPEC DONE`: the child spec has scope, contracts, dependencies, and acceptance
  criteria with no blocking open questions.
- `IMPLEMENTATION DONE`: the code for that child spec's current milestone scope
  is implemented, documented, and verified by the listed checks.
- `PARTIAL`: a useful vertical slice exists, but required acceptance criteria
  remain.
- `PENDING`: no meaningful implementation slice is complete yet.

Update rule:

- Every time a child spec reaches `IMPLEMENTATION DONE` for a milestone, update
  this section in the same change.
- Add a short comment describing what was completed, what evidence/checks prove
  it, and what remains for later milestones.
- Do not mark a child spec `IMPLEMENTATION DONE` just because scaffolding exists.
  The acceptance criteria for the current milestone must be met.

### Milestone Status

| Milestone | Status | Comment |
| --- | --- | --- |
| M0 Spec Baseline | DONE | Master spec, child specs, and parity matrix exist with no blocking open questions for foundation work. |
| M1 Foundation | DONE | Electron main/preload boundary, IPC facade, new SQLite initializer, runner health process, tests, frontend build, Electron build, and Linux unpacked packaging smoke are complete. |
| M2 Runner Vertical Slice | PARTIAL | App API can create a workflow, compile a simple graph, execute runner core events, enforce navigation allowlist in runner tests, register screenshot artifacts, and route `startRun` through the supervised JSONL runner process with streamed events. Real CloakBrowser-backed navigate/fill/click/wait smoke and streamed renderer subscription UI remain. |
| M3 Core Feature Parity | PENDING | Existing React UI is bridged to Electron for foundation APIs, but full P0 parity is not complete. |
| M4 Production Identity And Evidence | PARTIAL | Identity Profile storage, app API, preload contract, coherence validation foundation, runner fingerprint preflight gate, and sanitized preflight evidence persistence exist. Profile locking, UI/config wiring from saved profiles, real owned-probe smoke, run-profile selection, evidence viewer, and full operator policy enforcement remain. |
| M5 Packaging | PARTIAL | Linux unpacked `electron-builder --dir` smoke passes. Windows/macOS installers, signing/notarization, release manifest, and CloakBrowser binary distribution policy remain. |
| M6 Acceptance And Decommission | PENDING | Tauri/Rust app is still present as fallback; no decommission decision yet. |

### Child Spec Implementation Status

| Child Spec | Spec Status | Implementation Status | Comment |
| --- | --- | --- | --- |
| 01 Product Model | SPEC DONE | PARTIAL | Canonical concepts are reflected in shared Electron types and docs. Full workspace/profile/environment/run-profile model is not complete. |
| 02 Electron App Architecture | SPEC DONE | IMPLEMENTATION DONE for M1 | `electron/main/main.ts`, `electron/preload/preload.ts`, `electron/main/ipc.ts`, `src/lib/workflowApi.ts`, and `src/vite-env.d.ts` implement isolated renderer, typed preload API, IPC routing, and Tauri fallback. Verified by `src/lib/workflowApi.electron.test.ts`, `npm run build`, and `npm run build:electron`. |
| 03 Data And Storage | SPEC DONE | IMPLEMENTATION DONE for M1 | `electron/main/storage.ts` initializes the new SQLite workspace schema, workflows, active graph versions, run events, artifacts, soft delete, duplicate, and temporary settings snapshots. Verified by `electron/main/storage.test.ts`. Full secret references, import/export, retention cleanup, and profile inventories remain. |
| 04 Workflow Graph And Builder | SPEC DONE | PARTIAL | `electron/main/graph.ts` creates draft graphs, validates basic run blockers, enforces port uniqueness, and compiles simple linear action graphs to runner plans. Full graph logic/control compilation, debug model, and Electron-native graph UI parity remain. |
| 05 Action Catalog And Locator | SPEC DONE | PARTIAL | Runner/shared types and CloakBrowser adapter support locator-first navigate, click, fill, wait, screenshot, and extract-text shapes. Full action catalog schemas, defaults, summaries, help metadata, and P0/P1 runner mappings remain. |
| 06 CloakRunner | SPEC DONE | PARTIAL | `electron/runner/runnerCore.ts` executes runner plans with structured lifecycle/step/issue/artifact events, cancellation between actions, screenshot artifacts, allowlist checks, fingerprint preflight gating, and runtime action retries with `action.retrying` events. `runnerSupervisor` supports JSONL `startRun` event streaming, `cancelRun`, and terminal results through `electron/runner/stdioRunner.ts`. Action timeouts, downloads, traces, forceful cleanup, and real CloakBrowser smoke remain. |
| 07 Identity Profile And Fingerprint Preflight | SPEC DONE | PARTIAL | `identity_profiles` now has storage CRUD, app/preload API surface, renderer bridge wrappers, filesystem-safe persistent profile slug validation, mobile viewport/touch coherence checks, raw proxy-secret rejection, and runner preflight policy execution that blocks malformed or failed owned verdicts before workflow actions. Persistent profile locking, workflow default profile selection, runner snapshot resolution from saved profiles, and real owned probe smoke remain. |
| 08 Run Evidence And Audit | SPEC DONE | PARTIAL | Run events, artifact metadata, evidence records, recursive export sanitization, compact run evidence export, app/preload API surfaces, and preflight verdict evidence persistence are implemented. Evidence viewer UI, operator audit trail, strict evidence-policy failure behavior, and full export package flow remain. |
| 09 UI/UX Feature Parity | SPEC DONE | PARTIAL | Existing React UI can call Electron preload APIs for workflow, graph, settings, and run foundation commands. Full Electron-native parity for run history, identity editor, evidence viewer, import/export, issue panel, and streamed events remains. |
| 10 Packaging And Release | SPEC DONE | PARTIAL | Electron builder config and Linux unpacked package smoke pass. Windows/macOS targets, signing/notarization, release manifest, checksum verification, and CloakBrowser distribution mode remain. |
| 11 Testing And Acceptance | SPEC DONE | PARTIAL | Electron-focused unit tests, full frontend Vitest suite, frontend build, Electron build, and Linux packaging smoke pass. Full E2E, real CloakBrowser runner tests, packaging smoke per OS, and P0/P1 acceptance gates remain. |

### Completed Implementation Slice: 2026-05-09 Foundation

DONE in this slice:

- Electron app shell with secure BrowserWindow defaults.
- Preload `window.cloakBrowser` API and IPC route registration.
- Renderer API bridge that uses Electron preload when present and Tauri invoke
  as fallback.
- New Electron SQLite storage initializer and repository-style service.
- Workflow create/list/get/rename/delete/duplicate foundation.
- Active graph save/load, draft graph creation, basic validation, and simple
  compile-to-run-plan.
- Workflow Settings compatibility facade for the existing React UI.
- Runner core event sequence, allowlist failure, cancellation, screenshot
  artifact registration, and basic output capture event.
- CloakBrowser adapter scaffold using locator-first Playwright-style APIs.
- Runner process health-check supervisor over JSONL stdio.
- Electron build and Linux unpacked packaging smoke.

Verification for this slice:

- `npm test`
- `npm run build`
- `npm run build:electron`
- `npm run electron:package`

Known remaining blockers before replacement:

- Full P0 action catalog execution through real CloakBrowser.
- Supervised runner-process `startRun` protocol instead of only health-check
  plus in-process vertical slice.
- First-class Identity Profile CRUD and validation.
- Fingerprint preflight gate against allowlisted owned probe URLs.
- Evidence export and sanitizer.
- Electron-native import/export package flow.
- Run history and streamed run monitor UI.
- Windows/macOS packaging and platform smoke.
- Tauri/Rust decommission or fallback decision.

## Purpose

Rebuild the browser automation product as a new Electron/Node desktop app that
uses Playwright and CloakBrowser as the runner source of truth.

The rebuild intentionally does not migrate old SQLite data, Tauri command
contracts, Rust DTOs, or legacy workflow-step compatibility rows. It preserves
the product concepts that remain correct: workflows, graph authoring, workflow
settings, browser identity, run state, artifacts, and audit evidence.

The target product remains an internal adversarial browser automation lab for
authorized testing of company-owned production and staging systems. The new
architecture must make realistic browser execution, identity coherence, run
evidence, and operator control first-class requirements.

## Core Decision

Use a hybrid product-continuity and technical-rebuild strategy:

- Keep product concepts that are still correct.
- Replace the technical model completely.
- Build around Electron, Node, TypeScript, Playwright, and CloakBrowser.
- Do not preserve Tauri/Rust implementation contracts.
- Do not preserve old local database compatibility.

This avoids carrying Rust/Tauri-specific constraints into a runner that should
be Playwright/CloakBrowser-native.

## Goals

- Reach feature parity with the currently implemented product behavior.
- Add selected historical design capabilities to the main roadmap where they
  are foundational for the new architecture.
- Use Playwright and CloakBrowser official APIs directly in the runner.
- Keep browser automation outside the renderer process.
- Make identity profile, fingerprint preflight, and run evidence core product
  concepts rather than late add-ons.
- Support Windows, macOS, and Linux packaging.
- Make the rebuild controllable through a master spec, smaller specs, parity
  matrix, milestone gates, and acceptance criteria.

## Non-Goals

- Do not migrate old SQLite rows into the new product.
- Do not keep Rust `ActionConfig`, serde payloads, or Tauri command names.
- Do not copy the old UI implementation pixel-for-pixel.
- Do not keep hidden compatibility actions whose only purpose is reading old
  workflow data.
- Do not run Playwright or CloakBrowser directly inside the React renderer.
- Do not build CAPTCHA solving, unauthorized third-party account bypass,
  spam automation, or non-owned target automation.

## Product Concepts To Preserve

These concepts remain correct and should be redesigned for the new stack:

- `Workflow`: a saved automation definition.
- `Workflow Graph`: the primary visual authoring surface.
- `Workflow Settings`: per-workflow behavior and execution defaults.
- `Run Profile`: execution policy such as timeout, retention, concurrency, and
  evidence policy.
- `Identity Profile`: coherent browser, device, network, session, and locale
  identity.
- `Environment`: run setup such as permissions, geolocation, storage, headers,
  downloads, and variables.
- `Run`: a concrete execution instance.
- `Run Event`: a durable progress, issue, trace, or lifecycle event.
- `Artifact`: file-backed output such as screenshot, download, trace, or
  captured evidence.
- `Evidence`: compact audit data proving what ran, where, under which identity,
  and with which production verdicts.

## Technical Concepts To Replace

These are implementation details from the old app and should not constrain the
new design:

- Tauri command boundary.
- Rust domain DTOs and serde compatibility.
- Rust runner and chromiumoxide execution model.
- Old SQLite schema.
- Legacy `workflow_steps` compatibility rows.
- XPath-first targeting.
- Setup actions that should now be run-profile, identity-profile, or
  environment configuration.
- UI polling patterns that can be replaced by runner event streaming.

## Target Architecture

```text
Electron Main Process
  -> app lifecycle
  -> windows and native dialogs
  -> SQLite and file-backed artifact storage
  -> secure IPC routing
  -> runner process supervision

Preload Bridge
  -> narrow typed API exposed through contextBridge
  -> no broad Node access in renderer

React Renderer
  -> workflow list/detail
  -> graph builder
  -> settings editors
  -> run monitor
  -> evidence and artifact viewer

Node Runner Process
  -> Playwright + CloakBrowser official API
  -> browser/context/page lifecycle
  -> action execution
  -> cancellation and timeout handling
  -> event stream and artifact production
```

The runner process is local and supervised by Electron main. It is not a remote
backend. It may be implemented as a child process, worker process, or separately
spawned Node executable, but it must have a clear protocol and crash boundary.

## Master Spec Structure

This master spec coordinates the following smaller specs. Each spec must have a
clear owner, scope, dependency list, and acceptance criteria before it is turned
into an implementation plan.

1. **Product Model Spec**
   - Defines Workspace, Workflow, Graph, Run Profile, Identity Profile,
     Environment, Run, Run Event, Artifact, and Evidence.
   - Owns naming and product semantics used by all other specs.

2. **Electron App Architecture Spec**
   - Defines main, preload, renderer, IPC, runner supervision, process
     lifecycle, and security boundaries.
   - Requires renderer isolation and no direct Playwright access from UI code.

3. **Data And Storage Spec**
   - Defines the new SQLite schema, graph JSON versioning, run event storage,
     artifact metadata, artifact file layout, and secret reference strategy.
   - Explicitly excludes old database migration.

4. **Workflow Graph And Builder Spec**
   - Defines graph nodes, edges, ports, validation, compile-to-run-plan, undo,
     selection, and graph workspace behavior.
   - Keeps the graph as the primary authoring surface.

5. **Action Catalog And Locator Spec**
   - Defines the new Playwright-native action taxonomy.
   - Makes locators first-class: role, label, placeholder, text, test id, CSS,
     and XPath fallback.
   - Removes legacy hidden compatibility actions.

6. **CloakRunner Spec**
   - Defines the Node runner process, runner protocol, Playwright/CloakBrowser
     lifecycle, action execution, cancellation, retries, timeouts, downloads,
     screenshots, traces, and concurrency.

7. **Identity Profile And Fingerprint Preflight Spec**
   - Defines coherent browser/device/network/session identity.
   - Defines proxy, locale, timezone, viewport, storage, headed/headless policy,
     persistent profile reuse, owned-domain preflight probe, and verdict
     handling.

8. **Run Evidence And Audit Spec**
   - Defines run event taxonomy, action traces, artifact records, sanitized
     evidence export, production probe evidence, and operator audit trail.

9. **UI/UX Feature Parity Spec**
   - Defines product-equivalent UI behavior for workflow list, workflow detail,
     graph builder, settings, action editor, run monitor, issue panel, and
     evidence viewer.
   - Does not require copying old layout or implementation details.

10. **Packaging And Release Spec**
    - Defines Windows, macOS, and Linux packaging.
    - Defines Electron builder strategy, bundled runtime policy, CloakBrowser
      binary/version pinning, checksum validation, signing, notarization, and
      per-platform smoke tests.

11. **Testing And Acceptance Spec**
    - Defines unit, integration, runner, UI, E2E, and packaging checks.
    - Owns the parity matrix and milestone acceptance gates.

## Required Spec Format

Every child spec should use this format:

```text
1. Purpose
2. In Scope
3. Out Of Scope
4. Product Concepts
5. Technical Design
6. Interfaces / Contracts
7. Data Model
8. Error Handling
9. Security / Safety / Audit
10. Testing
11. Acceptance Criteria
12. Dependencies
13. Open Questions
```

Open questions are allowed while drafting a child spec, but a child spec cannot
enter implementation planning while it has unresolved questions that affect its
milestone acceptance.

## Dependency Map

```text
Product Model
  -> Electron App Architecture
  -> Data And Storage
  -> Workflow Graph And Builder
  -> Action Catalog And Locator
  -> CloakRunner
  -> Identity Profile And Fingerprint Preflight
  -> Run Evidence And Audit
  -> UI/UX Feature Parity
  -> Packaging And Release
  -> Testing And Acceptance
```

Some implementation can proceed in vertical slices, but specs must not define
contradictory concepts. Product Model, Architecture, Storage, Runner, Identity,
and Evidence need early agreement because they affect most later work.

## Feature Parity Definition

Feature parity is product-equivalent behavior, not old-code equivalence.

### Must Match Current Product

The new app must replace currently implemented product capabilities:

- Workflow list: create, rename/edit, duplicate, delete, import/export when
  treated as current product behavior.
- Workflow detail with graph workspace as the main authoring surface.
- Graph editor: add, connect, delete, configure, validate, compile, and run.
- Action editor for the product action catalog.
- Workflow settings: General, Execution, Browser/Identity, Environment,
  Variables, Triggers, and Advanced or their new equivalents.
- Run controls: run workflow, stop run, progress, terminal status.
- Run issue display for validation, runtime, and system errors.
- Browser/session behavior: profile reuse, proxy, user agent/device profile,
  headed/headless, retention, and session inspection where supported.
- Outputs and artifacts: extraction outputs, screenshots, downloads, traces,
  and captured evidence.
- Domain allowlist and operator safety controls.
- Local persistence and desktop packaging.

### Must Improve In New Architecture

The rebuild must improve these areas rather than merely copy old behavior:

- Locator-first targeting instead of XPath-first targeting.
- Identity Profile as a first-class model.
- Playwright/CloakBrowser official API as runner source of truth.
- Structured evidence from the first implementation slices.
- Runner event streaming instead of UI polling as the primary progress model.
- Artifact metadata in SQLite with file payloads stored outside the DB.
- Runner tests that can execute independent of the UI.

### Explicitly Not Required

The new app does not need:

- Old SQLite compatibility.
- Rust DTO or serde compatibility.
- Tauri command-name compatibility.
- Legacy step-row import.
- Hidden compatibility actions.
- Pixel-perfect UI copy.
- The old "test selected step by running from the beginning through that step"
  behavior if the new specs provide a better node or subgraph debugging model.

## Parity Matrix

The Testing And Acceptance Spec must maintain a parity matrix using this shape:

```text
Current Capability | New Owner Spec | New Equivalent | Acceptance Check | Priority
```

Example:

```text
Workflow Settings Browser profile reuse
-> Identity Profile Spec + CloakRunner Spec
-> Persistent CloakBrowser profile
-> Run twice with the same profile and verify session state persists
-> P0
```

Priorities:

- `P0`: required before the old app can be replaced for normal internal use.
- `P1`: required for full parity, can miss an early milestone with explicit
  deferral.
- `P2`: useful or future-facing, not required for replacement.

## Milestones

### M0: Spec Baseline

Acceptance:

- Master spec approved.
- Child specs have scope, dependencies, and acceptance criteria.
- Parity matrix includes P0/P1 product capabilities.
- Product Model, Runner, Identity, Evidence, and Storage specs do not
  contradict each other.

### M1: Foundation

Acceptance:

- Electron app boots.
- Main, preload, renderer, and IPC boundaries are in place.
- SQLite schema initializes.
- Runner process can spawn, report health, receive a no-op command, and exit.
- Test skeleton runs locally.

### M2: Runner Vertical Slice

Acceptance:

- A simple workflow can be created and run.
- CloakBrowser launches through Playwright.
- Navigate, fill, click, and wait actions execute.
- Run events stream to the UI.
- Stop/cancel works.
- Screenshot or equivalent artifact is saved and referenced in storage.

### M3: Core Feature Parity

Acceptance:

- Graph builder reaches product-equivalent core behavior.
- Workflow settings reach product-equivalent core behavior.
- P0 action catalog executes.
- Run issue panel and outputs work.
- Import/export is implemented if classified as P0 in the parity matrix.

### M4: Production Identity And Evidence

Acceptance:

- Identity Profile model is implemented.
- Fingerprint preflight gate works against allowlisted owned probe URLs.
- Domain allowlist and operator controls are enforced.
- Evidence export is sanitized by default.

### M5: Packaging

Acceptance:

- Windows `.exe`, macOS, and Linux builds are produced.
- CloakBrowser and runtime version pinning are documented and verified.
- Platform-specific smoke tests pass or have explicit environment blockers.

### M6: Acceptance And Decommission

Acceptance:

- All P0 parity matrix items pass.
- P1 items pass or have explicit deferrals with rationale.
- The old Tauri/Rust app has an archive, decommission, or fallback decision.

## Runner Design Commitments

- Playwright/CloakBrowser APIs are the primary automation interface.
- The runner must run outside the React renderer.
- The runner must emit structured events rather than only returning terminal
  results.
- Cancellation must be cooperative and forceful enough to clean up browser
  processes.
- Browser profiles must be explicit and reproducible.
- Concurrency must be controlled because browser processes dominate CPU and
  memory use.
- Traces, screenshots, downloads, and probe verdicts are artifacts or evidence,
  not ad hoc log strings.

## Identity And Safety Commitments

- Identity profiles must keep browser, device, locale, timezone, storage, and
  network posture coherent.
- Sensitive runs must support allowlisted owned domains and named test accounts.
- Fingerprint preflight must stop a run before workflow actions when an owned
  probe returns a malformed or blocking verdict.
- Evidence must omit proxy passwords, raw secrets, and unnecessary sensitive
  storage values by default.
- Manual challenge and checkpoint flows are handoff and evidence points, not
  automated challenge bypass features.

## Packaging Commitments

- The app must build for Windows, macOS, and Linux.
- The packaging design must decide whether CloakBrowser is bundled, installed
  from an internal artifact mirror, or selected by operator-provided path.
- Version and checksum pinning are required for reproducibility.
- macOS signing/notarization, Windows process cleanup, and Linux browser
  dependency handling must each have explicit smoke checks.

## Major Risks

- Scope can expand if feature parity is not controlled by P0/P1/P2.
- Electron plus CloakBrowser can use significant RAM and CPU if concurrency is
  not limited.
- CloakBrowser binary licensing, bundling, and release pinning need explicit
  release policy.
- Cross-platform packaging can fail late if not tested as its own milestone.
- Runner process crashes must not corrupt run state or leave unmanaged browser
  processes.
- Identity and evidence features must stay inside owned or explicitly
  authorized testing scope.

## Design Review Checklist

Before implementation planning begins:

- No child spec defines a second source of truth for the same concept.
- Product concepts have one canonical name.
- Runner events, storage records, and UI state describe the same run lifecycle.
- Identity Profile, Environment, and Run Profile boundaries are not overlapping
  ambiguously.
- Evidence storage distinguishes file artifacts from compact metadata.
- The parity matrix has enough P0 detail to decide whether the new app can
  replace the current app.

## Next Step

After this master spec is reviewed, write the child specs in dependency order.
Implementation planning should begin only after the relevant child specs for the
first milestone are approved.
