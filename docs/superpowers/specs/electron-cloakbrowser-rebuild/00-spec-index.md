# Electron CloakBrowser Rebuild Spec Index

## Purpose

Index the child specs for the Electron/Node + Playwright/CloakBrowser rebuild.
The master spec remains the program-level source of truth. This index is the
local navigation file for the child spec set.

## Master Spec

- `../2026-05-09-electron-cloakbrowser-rebuild-master-design.md`

## Child Specs

1. `01-product-model-spec.md`
2. `02-electron-app-architecture-spec.md`
3. `03-data-and-storage-spec.md`
4. `04-workflow-graph-and-builder-spec.md`
5. `05-action-catalog-and-locator-spec.md`
6. `06-cloakrunner-spec.md`
7. `07-identity-profile-and-fingerprint-preflight-spec.md`
8. `08-run-evidence-and-audit-spec.md`
9. `09-ui-ux-feature-parity-spec.md`
10. `10-packaging-and-release-spec.md`
11. `11-testing-and-acceptance-spec.md`

## Supporting Documents

- `parity-matrix.md`

## Current Implementation Progress

Last updated: 2026-05-09.

- M0 Spec Baseline: DONE.
- M1 Foundation: DONE.
- M2 Runner Vertical Slice: PARTIAL.
- M3 Core Feature Parity: PENDING.
- M4 Production Identity And Evidence: PARTIAL.
- M5 Packaging: PARTIAL.
- M6 Acceptance And Decommission: PENDING.

Child spec implementation summary:

| Spec | Implementation Status |
| --- | --- |
| 01 Product Model | PARTIAL: workspace policy, run profiles, environments, identity profiles, run/event/artifact/evidence foundations exist; profile inventory and full UI coverage remain |
| 02 Electron App Architecture | IMPLEMENTATION DONE for M1 plus renderer run-event forwarding foundation |
| 03 Data And Storage | IMPLEMENTATION DONE for M1 plus workspace allowed-origin policy, run profiles, environments, terminal run status, identity profiles, evidence records, and compact evidence export foundations |
| 04 Workflow Graph And Builder | PARTIAL |
| 05 Action Catalog And Locator | PARTIAL |
| 06 CloakRunner | PARTIAL: supervised `startRun`/`cancelRun`, event streaming, preflight gate, screenshot artifacts, artifact path isolation, allowlist checks, workspace max concurrency enforcement, runtime retries, and action timeouts implemented; real CloakBrowser smoke, downloads, traces, and forceful cleanup remain |
| 07 Identity Profile And Fingerprint Preflight | PARTIAL: storage CRUD, app/preload API, renderer wrappers, basic coherence validation, workflow default profile run wiring, persistent profile locking/availability, and runner preflight gate implemented; full UI wiring and real owned probe smoke remain |
| 08 Run Evidence And Audit | PARTIAL: run events, terminal run status, run history, safe artifact metadata, evidence records, sanitizer, compact export, API surface, preflight evidence persistence, persistent profile lock lifecycle events, strict screenshot artifact policy behavior, and Stop audit evidence implemented; evidence viewer, broader operator audit, and evidence write failure handling remain |
| 09 UI/UX Feature Parity | PARTIAL: Electron preload/API foundations exist for workflow, graph, settings, workflow default profile/environment selection, run profiles, environments, run start/state/history/event subscription, identity profiles including availability checks, workspace policy, and evidence export; user-facing Electron-native editors/viewers and run monitor remain |
| 10 Packaging And Release | PARTIAL |
| 11 Testing And Acceptance | PARTIAL |

The master spec contains the detailed comments and verification evidence. Any
future implementation slice that completes a child spec milestone must update
both this summary and the master spec progress table.

## Dependency Order

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

## Review Rule

Do not start implementation planning for a milestone until the specs that feed
that milestone have no blocking open questions and the parity matrix items for
that milestone have acceptance checks.
