# Electron CloakBrowser Rebuild Parity Matrix

## Purpose

Track product-equivalent parity from the current app into the new
Electron/Node + Playwright/CloakBrowser app.

Priorities:

- `P0`: required before the new app can replace the old app for normal internal
  use.
- `P1`: required for full parity, but may be deferred from an early milestone
  with explicit rationale.
- `P2`: future or useful capability, not required for replacement.

## Matrix

| Current Capability | New Owner Spec | New Equivalent | Acceptance Check | Priority |
| --- | --- | --- | --- | --- |
| Create workflow | Product Model, Data And Storage, UI/UX | New workflow record with draft graph | User creates workflow and opens detail with start/draft graph | P0 |
| Rename/edit workflow metadata | Product Model, Data And Storage, UI/UX | Workflow metadata editor | Save name/description/tags and verify list/detail update | P0 |
| Delete workflow | Data And Storage, UI/UX | Soft or confirmed delete | Delete workflow through confirmation and verify it is hidden from list | P0 |
| Duplicate workflow | Data And Storage, UI/UX | Copy workflow, graph, settings refs/snapshots as designed | Duplicate workflow and verify graph/settings are independent | P1 |
| Workflow package export | Data And Storage, Run Evidence, UI/UX | Sanitized workflow export package | Export workflow and verify secrets/browser profile data are excluded | P1 |
| Workflow package import | Data And Storage, UI/UX | Import creates new workflow ids | Import package and verify no existing workflow is overwritten | P1 |
| Graph workspace as authoring surface | Workflow Graph, UI/UX | React graph workspace | Create/edit workflow entirely through graph detail screen | P0 |
| Add/connect/delete graph nodes | Workflow Graph, UI/UX | Node/edge/port editor | Add action and logic nodes, connect ports, delete selection | P0 |
| Graph validation before run | Workflow Graph, Testing | Graph validator with issue mapping | Invalid graph blocks run and highlights node/edge/field | P0 |
| Compile graph to executable plan | Workflow Graph, CloakRunner | Runner-native run plan | Valid graph compiles with node ids preserved | P0 |
| Action palette/editor | Action Catalog, UI/UX | Playwright-native action catalog and inspector | Add/configure P0 actions from palette | P0 |
| Navigation action | Action Catalog, CloakRunner | Playwright/CloakBrowser navigate | Run workflow navigates to controlled test page | P0 |
| Fill field action | Action Catalog, CloakRunner | Locator-first fill/type action | Fill controlled input and verify value | P0 |
| Click action | Action Catalog, CloakRunner | Locator-first click action | Click controlled button and verify page state changes | P0 |
| Wait action | Action Catalog, CloakRunner | Fixed/condition wait | Wait for controlled page condition without failing | P0 |
| Screenshot artifact | CloakRunner, Run Evidence | File-backed screenshot artifact | Run creates screenshot artifact metadata and file | P0 |
| Extract text/output | Action Catalog, CloakRunner, Run Evidence | Captured variable/output event | Extract text from controlled page and show in run output | P0 |
| Download artifact | Action Catalog, CloakRunner, Run Evidence | File-backed download artifact | Trigger controlled download and register artifact | P1 |
| Workflow settings General | Product Model, Data And Storage, UI/UX | Workflow metadata/settings section | Edit and save general workflow settings | P0 |
| Workflow settings Execution | Product Model, Data And Storage, CloakRunner, UI/UX | Run Profile | Configure timeout/retention and verify runner uses snapshot | P0 |
| Workflow settings Browser | Identity Profile, UI/UX | Identity Profile selection/editor | Select profile and run with profile snapshot | P0 |
| Environment defaults | Product Model, Data And Storage, CloakRunner | Environment entity | Apply initial variables/permissions/storage in run setup | P1 |
| Variables | Product Model, Workflow Graph, CloakRunner | Runtime variables and templates | Seed variable and use it in action text | P0 |
| Triggers section | UI/UX, Product Model | Planned metadata until scheduler exists | UI clearly marks trigger config as planned/inactive | P1 |
| Advanced diagnostics | UI/UX, Run Evidence | Diagnostics/profile/run evidence views | Operator can inspect runner/profile diagnostics | P1 |
| Run workflow | CloakRunner, UI/UX, Testing | Start run through main-supervised runner | Start run and receive terminal status | P0 |
| Stop active run | CloakRunner, Electron Architecture, UI/UX | Cancel runner command | Stop run and verify terminal cancelled/stopped event | P0 |
| Run progress | CloakRunner, Run Evidence, UI/UX | Runner event stream | Step events update graph/run monitor | P0 |
| Runtime issue panel | Run Evidence, UI/UX | Persisted issues linked to node/profile/run | Failed action shows issue with node context | P0 |
| Browser profile reuse | Identity Profile, CloakRunner, Data And Storage | Persistent CloakBrowser profile | Run twice with same profile and verify session state persists | P0 |
| Proxy configuration | Identity Profile, CloakRunner, Run Evidence | Proxy reference and sanitized metadata | Run with proxy ref and verify evidence omits password | P1 |
| User agent/device profile | Identity Profile, CloakRunner | Coherent identity profile | Run with selected device profile and verify context options/evidence | P0 |
| Headed/headless setting | Identity Profile, CloakRunner | Headed/headless policy | Profile blocks disallowed mode and runner honors allowed mode | P0 |
| Browser retention | Run Profile, CloakRunner | Retain/close policy | Terminal run applies configured retention behavior | P1 |
| Domain allowlist | Product Model, CloakRunner, Identity Profile | Workspace/operator policy plus runner enforcement | Navigation outside allowlist is blocked before page action | P0 |
| Fingerprint preflight | Identity Profile, CloakRunner, Run Evidence | Owned probe verdict gate | Malformed/failed verdict blocks before workflow actions | P1 |
| Action traces | CloakRunner, Run Evidence | Structured action trace events | Run stores mode/locator/timing/failure trace metadata | P0 |
| Evidence export | Run Evidence, UI/UX | Sanitized run evidence package | Export run evidence and verify secrets are excluded | P1 |
| Local persistence | Data And Storage | New SQLite schema | Restart app and verify workflows/profiles/runs persist | P0 |
| Packaged Windows app | Packaging, Testing | Windows installer/exe | Packaged app boots and runner health check passes | P1 |
| Packaged macOS app | Packaging, Testing | macOS app package | Packaged app boots and runner health check passes | P1 |
| Packaged Linux app | Packaging, Testing | Linux package/AppImage as selected | Packaged app boots and runner health check passes | P1 |

## Review Rule

Before starting implementation planning for a milestone, update this matrix so
every in-scope P0/P1 item has a concrete acceptance check and owner spec.
