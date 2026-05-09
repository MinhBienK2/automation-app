# Testing And Acceptance Spec

## Purpose

Define the test strategy, parity matrix, milestone gates, and acceptance
criteria for the Electron/CloakBrowser rebuild.

This spec prevents the rewrite from becoming open-ended by making parity and
production readiness measurable.

## In Scope

- Test layers.
- Parity matrix format and initial P0/P1 categories.
- Milestone acceptance gates.
- CI/local check expectations.
- Release smoke tests.
- Docs/spec review gates.

## Out Of Scope

- Exact CI provider configuration.
- Full implementation plan.
- Exhaustive test case files.
- Production monitoring integration.

## Product Concepts

Testing must verify:

- workflow authoring;
- graph validation/compile;
- action execution;
- identity profile coherence;
- preflight behavior;
- run events;
- artifacts/evidence;
- packaging.

## Technical Design

### Test Layers

- Unit tests: pure functions, schemas, validators, reducers.
- Service tests: storage repositories, IPC handlers, policy services.
- Runner tests: Playwright/CloakBrowser execution against controlled pages.
- Renderer tests: React UI with mocked preload API.
- Integration tests: main + runner process protocol.
- E2E tests: packaged or dev app flows.
- Packaging smoke tests: installed/bundled app launch and runner health.

### Test Data

Use controlled local test pages and owned/staging endpoints only. Tests must not
depend on unauthorized third-party targets.

### Parity Matrix

Shape:

```text
Current Capability | New Owner Spec | New Equivalent | Acceptance Check | Priority
```

Initial P0 categories:

- Create/open/delete workflow.
- Graph save/load/validate/compile.
- Add and configure P0 actions.
- Run workflow with CloakBrowser.
- Stop/cancel active run.
- Run progress display.
- Runtime issue display.
- Persistent identity profile/session reuse.
- Proxy/profile validation with sanitized evidence.
- Screenshot artifact.
- Extracted output.
- Download artifact if current product treats it as core.
- Workflow settings core sections.
- Domain allowlist block.
- Local persistence.

Initial P1 categories:

- Import/export workflow package.
- Duplicate workflow.
- Advanced graph logic beyond P0 vertical slice.
- Full action catalog parity.
- Fingerprint preflight gate.
- Evidence export.
- Packaged builds for all OS targets.
- Run history browsing.

P2 categories:

- Future scheduler activation.
- Multi-workspace support.
- Cloud sync.
- External reporting integrations.

Priorities can be adjusted only by updating the parity matrix with rationale.

### Milestone Gates

M0 Spec Baseline:

- master spec and child specs approved;
- parity matrix populated;
- no blocking open questions in specs needed for M1.

M1 Foundation:

- app boots;
- IPC boundary tested;
- storage initializes;
- runner health check passes.

M2 Runner Vertical Slice:

- navigate/fill/click/wait workflow runs;
- events stream to UI;
- cancellation works;
- screenshot artifact stored.

M3 Core Feature Parity:

- P0 parity items pass;
- P1 deferrals documented;
- run issues/artifacts/evidence visible.

M4 Production Identity And Evidence:

- identity profile tests pass;
- preflight tests pass;
- sanitized evidence export passes;
- allowlist policy tests pass.

M5 Packaging:

- packaged app smoke test passes per target;
- release manifest generated;
- runtime/browser versions verified.

M6 Acceptance And Decommission:

- all P0 pass;
- P1 pass or explicit deferral;
- old app archive/decommission decision recorded.

## Interfaces / Contracts

Every spec must provide acceptance criteria that map into one or more tests or
manual smoke checks.

Test commands should be standardized during implementation planning. Expected
categories:

- typecheck;
- unit tests;
- renderer tests;
- runner tests;
- integration tests;
- E2E smoke;
- package smoke.

## Data Model

Testing owns the parity matrix document. It can be stored as Markdown or JSON,
but it must be easy to diff and update.

Suggested path:

```text
docs/superpowers/specs/electron-cloakbrowser-rebuild/parity-matrix.md
```

## Error Handling

- Failing P0 tests block replacement milestone.
- Flaky runner tests must be quarantined only with explicit owner and reason.
- Packaging smoke blockers must identify platform and missing dependency.
- Test failures involving owned production/staging endpoints must preserve
  sanitized evidence.

## Security / Safety / Audit

- Tests use owned or local targets.
- Secrets are loaded through test-safe fixtures or secret refs, not committed.
- Evidence export tests assert secrets are removed.
- Browser profile tests isolate profile directories per test.
- Destructive cleanup touches only test-controlled paths.

## Testing

This spec is itself tested by review:

- every child spec has acceptance criteria;
- parity matrix has owner specs for P0/P1;
- every milestone has objective pass/fail gates;
- no implementation starts without tests defined for that slice.

## Acceptance Criteria

- Parity matrix exists and is populated before implementation planning.
- P0/P1/P2 definitions are documented.
- Milestones have pass/fail criteria.
- Test layers cover renderer, main, storage, runner, evidence, and packaging.
- Safety and owned-scope constraints are tested.

## Dependencies

- All child specs.

## Open Questions

None blocking. Exact command names are implementation planning details.
