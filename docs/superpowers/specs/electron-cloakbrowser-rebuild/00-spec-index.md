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
