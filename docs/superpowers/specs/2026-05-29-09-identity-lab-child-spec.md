# Mission Control UI/UX Upgrade Child Spec 09: Identity Lab

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows:

- `docs/superpowers/specs/2026-05-28-mission-control-full-product-ui-ux-upgrade-master-spec.md`
- `docs/superpowers/specs/2026-05-28-01-foundation-ui-system-child-spec.md`
- `docs/superpowers/specs/2026-05-29-02-shell-navigation-search-alerts-child-spec.md`
- `docs/superpowers/specs/2026-05-29-03-workflow-library-package-management-child-spec.md`
- `docs/superpowers/specs/2026-05-29-04-recording-review-child-spec.md`
- `docs/superpowers/specs/2026-05-29-05-graph-builder-child-spec.md`
- `docs/superpowers/specs/2026-05-29-06-workflow-settings-child-spec.md`
- `docs/superpowers/specs/2026-05-29-07-run-launch-monitoring-child-spec.md`
- `docs/superpowers/specs/2026-05-29-08-evidence-explorer-child-spec.md`

It owns the Identity Lab workspace. Workflow Settings owns editing browser
launch identity settings. Evidence Explorer owns historical evidence browsing.
Runs owns run monitoring. Identity Lab owns current managed identity posture,
historical identity references, retained-session actions, guarded reset, and
cross-workspace traceability.

## Brainstorming Scope

The user asked for one-spec-at-a-time `$brainstorming` and pre-approved the
recommended choices. This spec records the identity-specific decisions so the
implementation stays safe and does not turn Identity Lab into an editor for
Browser Launch internals.

Identity Lab is security-sensitive because it touches browser identities,
profile reuse, retained sessions, fingerprint posture, diagnostics, and
historical evidence. The UI must be explicit about what actions do and do not
delete.

## Brainstorming Decisions

### Decision 1: Workspace Role

Question: should Identity Lab edit identities, diagnose identities, or audit and
operate them?

Options considered:

- Identity editor.
  - Pros: all identity fields in one place.
  - Cons: duplicates Workflow Settings and risks conflicting edits.
- Read-only dashboard.
  - Pros: safe.
  - Cons: cannot close retained sessions or reset identity from operations view.
- Audit and operations workspace.
  - Pros: shows posture, evidence, diagnostics, retained session state, and
    guarded actions while keeping editing in Workflow Settings.
  - Cons: requires clear action boundaries.

Recommended and approved: audit and operations workspace.

### Decision 2: Historical Identity Behavior

Question: should historical identities behave like current managed identities?

Options considered:

- Same actions as managed identities.
  - Pros: visually consistent.
  - Cons: dangerous; historical identity is not attached to current settings.
- Hide historical identities.
  - Pros: simpler.
  - Cons: breaks evidence traceability.
- Read-only historical detail.
  - Pros: safe and traceable.
  - Cons: less interactive.

Recommended and approved: historical identity references are read-only.

### Decision 3: Close Retained Session

Question: should Close Retained Session be a simple button or guarded action?

Options considered:

- Simple button.
  - Pros: fast.
  - Cons: users may confuse it with deleting profile data.
- Guarded action with explanation.
  - Pros: makes scope explicit and preserves trust.
  - Cons: extra confirmation if implemented.

Recommended and approved: guarded action or at minimum strongly scoped copy. It
must say it closes only in-memory retained browser context and does not delete
profile data.

### Decision 4: Reset Identity

Question: should Reset Identity in Identity Lab reuse Workflow Settings command
or create a new flow?

Options considered:

- New Identity Lab reset command.
  - Pros: tailored UI.
  - Cons: duplicates backend guard logic.
- Reuse existing guarded backend command.
  - Pros: one source of truth; same semantics as Workflow Settings.
  - Cons: UI must explain settings update result.

Recommended and approved: reuse `resetWorkflowBrowserIdentity`.

### Decision 5: Diagnostics Depth

Question: should diagnostics show raw machine paths and profile internals?

Options considered:

- Full raw diagnostics.
  - Pros: detailed debugging.
  - Cons: violates display boundaries.
- Sanitized readiness summary.
  - Pros: useful and safe.
  - Cons: advanced debugging may need separate command later.

Recommended and approved: sanitized readiness summary only.

### Decision 6: Cross-Workspace Links

Question: should Identity Lab embed Evidence and Runs detail inline?

Options considered:

- Inline detail.
  - Pros: fewer navigations.
  - Cons: duplicates Evidence/Runs and expands scope.
- Compact summary plus links.
  - Pros: clear ownership.
  - Cons: one click away.

Recommended and approved: compact summary plus links.

### Decision 7: Component Split

Question: should IdentityLabPage stay one file?

Options considered:

- Keep one file.
  - Pros: simple.
  - Cons: list/detail/historical/actions/diagnostics will grow.
- Split by list, detail, sections, dialogs.
  - Pros: easier tests and safer future edits.
  - Cons: more files.

Recommended and approved: split by responsibility when implementing a deeper
UI pass.

## Goal

Turn Identity Lab into a clear operations workspace for workflow-owned browser
identities. Operators should understand current identity posture, retained
session state, recent evidence, diagnostics, rotation history, and safe actions
without seeing raw profile internals.

The implementation must:

1. Distinguish managed current identities from read-only historical references.
2. Show managed identity posture and diagnostics in bounded sections.
3. Show retained session state and safe close action.
4. Show reset identity action with confirmation and backend guard.
5. Show latest observed identity evidence and rotation history.
6. Link to Evidence, Runs, Workflow Detail, and Workflow Settings.
7. Preserve sensitive data boundaries.
8. Work at compact desktop size.

## Inputs And Sources Of Truth

### Required Reading Before Implementation

Follow repo workflow first:

1. `docs/README.md`
2. `docs/task-routes.md`
3. `DESIGN.md`
4. `docs/domain/user-visible-invariants.md`
5. `docs/domain/workflow-lifecycle.md`
6. `docs/domain/execution-semantics.md`
7. `docs/contracts/electron-ipc.md`
8. `docs/contracts/run-state.md`
9. `docs/contracts/workflow-types.md`
10. `docs/architecture/frontend.md`
11. Workflow Settings child spec.
12. Runs Monitoring child spec.
13. Evidence Explorer child spec.
14. This spec.

### Visual Baseline

Use:

- `.stitch/designs/2026-05-28-12-polished-05-identity-lab.html`

Use it for:

- workspace density;
- identity list/detail split;
- KPI treatment;
- posture section rhythm;
- action hierarchy.

Do not copy unsupported identity editing fields into Identity Lab.

### Current Source Areas

Primary files likely touched:

- `src/features/identities/pages/IdentityLabPage.tsx`
- `src/App.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `src/styles/responsive.css`

Backend files only if read model or command behavior must change:

- `electron/backend/identity/identityRepository.ts`
- `electron/backend/commands.ts`
- `electron/backend/browser/sessionManager.ts`
- `electron/backend/runtime/runManager.ts`

Likely tests:

- add `src/features/identities/pages/IdentityLabPage.test.tsx`
- `src/App.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/commands.test.ts` if command behavior changes
- identity repository tests if read model changes

## Current Implementation Readout

### Identity Page

Current `IdentityLabPage.tsx` already:

- shows header and refresh;
- shows KPI counts;
- lists managed identities;
- selects managed identity;
- renders managed detail;
- renders historical detail;
- links to Evidence, Run, Workflow Settings, Workflow;
- closes retained session when available;
- resets identity through confirmation;
- shows configured posture;
- shows latest observed;
- shows diagnostics;
- shows evidence summary;
- shows rotation history;
- shows empty/loading/error states.

Current problem:

- The structure is right but needs deeper action scoping, stronger historical
  treatment, clearer diagnostics boundaries, better stale target states, and
  tests.

### Identity Repository

Current `identityRepository.ts` already:

- builds managed summaries from workflows/settings;
- searches identities;
- selects managed or historical target;
- returns managed detail with session, posture, observed evidence, last run,
  evidence summary, rotation history, diagnostics, actions;
- returns historical detail from run/evidence context;
- uses diagnostics snapshot;
- avoids raw profile path display in the DTO.

Current problem:

- UI must preserve DTO boundaries and avoid deriving posture from raw run
  outputs.

### App Orchestration

Current `App.tsx` already:

- stores `identityLabOverview`;
- stores `identityLabTarget`;
- loads overview with selected target;
- opens Identity from command search/evidence/run;
- selects managed identity;
- opens identity evidence;
- opens identity run;
- opens workflow settings;
- closes retained session;
- resets identity from lab;
- routes historical identity targets.

Current problem:

- The UI must make target type and action consequences explicit.

## Scope Boundaries

### In Scope

- Identity Lab layout.
- KPI strip.
- Managed identity list.
- Managed detail sections.
- Historical read-only detail.
- Retained session close UX.
- Reset identity confirmation UX.
- Diagnostics presentation.
- Evidence/run/workflow/settings links.
- Rotation history presentation.
- Empty/loading/error/stale states.
- Component/helper split.
- Focused tests.

### Out Of Scope

- Editing Browser Launch fields.
- Editing persona/proxy/timezone/locale in Identity Lab.
- Creating identities independent of workflows.
- Deleting identity records.
- Deleting browser profile data.
- Showing raw profile paths.
- Showing cookies/browser storage.
- Raw diagnostics viewer.
- Evidence artifact preview.
- Run history browser.

## Non-Negotiable Invariants

Preserve these:

- Identities is a separate sidebar page after Schedules and before Settings.
- Identity Lab lists workflow-owned current browser identities.
- Identity Lab shows managed identity posture/diagnostics/run context.
- Identity Lab opens read-only historical references for old identity ids from
  evidence or rotation history.
- Identity results derived from persisted evidence open read-only historical
  context tied to evidence run.
- Identity actions call typed backend commands.
- Renderer does not derive posture from raw run outputs or diagnostics.
- Close Retained Session closes only matching in-memory retained browser
  context.
- Close Retained Session does not delete profile data, cookies/login state,
  workflow settings, evidence, or historical runs.
- Reset Identity uses guarded backend identity reset command.
- Reset Identity is unavailable while active run or retained session blocks it.
- Browser identity editing remains in Workflow Settings Browser Launch.
- Raw profile paths, browser storage, cookies, proxy credentials, and raw
  diagnostics are not rendered.

## Identity Lab Information Architecture

Identity Lab has four zones:

1. Header.
2. KPI strip.
3. Identity list.
4. Identity detail.

Header answers:

- where am I;
- when was identity data refreshed;
- how to refresh.

KPI strip answers:

- how many managed identities exist;
- how many retained sessions are active;
- how many recent failures need attention;
- optionally how many warning badges exist.

Identity list answers:

- which current workflow identities exist;
- which one is selected;
- which have retained sessions or failures.

Detail answers:

- what identity is selected;
- whether it is managed or historical;
- what posture/evidence/diagnostics exist;
- what safe actions are available.

## Header Requirements

Header shows:

- eyebrow: `Identity Workspace`;
- title: `Identity Lab`;
- last refreshed timestamp;
- Refresh action;
- page-level error.

Refresh:

- reloads current target;
- preserves selection where possible;
- does not clear useful previous data on command failure if parent supports it.

Error:

- alert region;
- command-facing message;
- no raw stack traces.

## KPI Requirements

KPI cards:

- Managed identities.
- Retained sessions.
- Recent failures.
- Warnings if current count exists.

Treatment:

- compact cards;
- no oversized hero metrics;
- status tone not color-only;
- counts derived from `overview.counts`.

At compact desktop, KPI cards wrap.

## Managed Identity List Requirements

Each row shows:

- display name or identity id;
- workflow name;
- short identity id;
- persona label if available;
- session mode/profile reuse marker;
- retained session state;
- recent failure badge if non-zero;
- warning badges if any.

Selection:

- row button selects managed identity through `onSelect(workflowId, identityId)`;
- selected row is visibly active and accessible;
- selected state is not color-only.

Empty states:

- Loading identities.
- No managed identities.
- Search no matches if search is added.

Do not show:

- raw profile path;
- proxy credentials;
- local storage/cookies.

## Managed Detail Requirements

### Header

Show:

- identity display name or id;
- workflow name;
- identity id in monospace;
- managed/current marker;
- retained session status;
- latest run status if available.

### Action Bar

Actions:

- Open Evidence.
- Open Last Run when available.
- Open Workflow.
- Open Workflow Settings.
- Close Retained Session when available.
- Reset Identity when available or disabled with reason.

Action hierarchy:

- navigation actions are secondary;
- Close Retained Session is caution/secondary or guarded;
- Reset Identity is destructive/guarded.

### Configured Posture Section

Show bounded posture rows from DTO:

- persona;
- session mode;
- proxy status with credentials redacted;
- timezone/locale or GeoIP state;
- WebRTC policy;
- humanize status;
- headless if DTO provides it;
- fingerprint/font status summary if DTO provides it.

Do not add editing controls. Use Open Workflow Settings for edits.

### Latest Observed Section

Show:

- run id;
- observed timestamp;
- safe fields from browser identity evidence.

Rules:

- use typed `latest_observed.fields`;
- do not render raw output JSON;
- if no observation, show empty copy.

### Diagnostics Section

Show:

- binary installed/version;
- GeoIP available;
- headed display available;
- font status;
- approximate profile size if DTO provides it;
- active session marker if DTO provides it.

Do not show:

- raw binary path;
- cache path;
- profile path;
- font directory path;
- raw diagnostics object.

### Evidence Section

Show:

- matching evidence count;
- Open Evidence action;
- empty state if no evidence.

Open Evidence filters by workflow and identity id.

### Rotation History Section

Show:

- previous identity id;
- next/current identity id if available;
- migration message;
- timestamp if DTO adds it;
- action to open historical identity target when previous id exists.

Historical target:

- type `historical`;
- identity id previous;
- workflow id current workflow.

Do not treat rotation history as editable.

## Historical Detail Requirements

Historical detail is read-only.

Header shows:

- `Historical Identity Reference`;
- identity id;
- read-only badge/warning;
- related workflow/run/evidence context where available.

Allowed actions:

- Open Related Run when run id exists.
- Open Related Workflow when workflow exists.
- Open Related Evidence when evidence id exists and navigation is implemented.

Forbidden actions:

- Close Retained Session.
- Reset Identity.
- Open Workflow Settings for the historical identity itself.
- Edit identity fields.

Observed Fields:

- render bounded observed fields from DTO;
- empty state if no fields.

Copy must make clear:

- this identity is no longer attached to current workflow settings;
- current workflow may have a different active identity.

## Close Retained Session Requirements

Close Retained Session:

- only shown/enabled when `actions.can_close_retained_session`;
- requires `session.profile_name`;
- calls `closeIdentityRetainedSession(workflowId, profileName)`;
- should be confirmed if implementation can add confirmation cleanly.

Confirmation/copy must state:

- closes only the in-memory retained browser context;
- does not delete profile data;
- does not delete cookies/login state;
- does not delete workflow settings;
- does not delete evidence;
- does not delete historical runs;
- run-from-selected may become unavailable until a new retained session exists.

After success:

- reload Identity Lab overview/detail;
- session status becomes inactive;
- Run from selected checks report missing retained session.

On failure:

- show command error;
- keep detail visible.

## Reset Identity Requirements

Reset Identity:

- shown for managed identities only;
- disabled when `actions.can_reset_identity` is false;
- disabled reason shown when available;
- opens confirmation;
- calls existing `resetWorkflowBrowserIdentity(workflowId)`;
- parent reloads overview with new managed identity target.

Confirmation must state:

- workflow name;
- current identity id;
- identity id/profile/fingerprint seed will rotate;
- non-storage preferences such as proxy/locale/fingerprint fonts may be
  preserved by backend contract;
- historical runs and evidence remain unchanged;
- current retained session/active run can block reset.

On success:

- selected target becomes new identity id;
- toast/status may say reset succeeded;
- rotation history records old/new identity.

On failure:

- confirmation remains or page shows error;
- no stale success message;
- detail remains visible.

Renderer must not generate identity ids or fingerprint seeds.

## Cross-Workspace Navigation

Identity Lab supports:

- sidebar -> Identity Lab overview;
- command search -> managed identity target;
- Evidence detail -> historical identity target;
- Runs detail -> managed identity target;
- Identity detail -> Evidence filtered by workflow/identity;
- Identity detail -> Runs focused last run;
- Identity detail -> Workflow Detail;
- Identity detail -> Workflow Settings Browser Launch;
- Rotation history -> historical identity target.

Rules:

- use typed `IdentityLabTarget`;
- stale targets render unavailable/read-only state;
- do not silently select the first identity when a specific target is missing
  unless page also communicates target failure.

## Data Flow

### Loading Overview

1. App calls `getIdentityLabOverview({ selected_target })`.
2. Backend returns overview, items, counts, selected detail.
3. App stores overview and target.
4. Page renders list and detail.

### Selecting Managed Identity

1. User selects row.
2. Page calls `onSelect(workflowId, identityId)`.
3. App opens identities with managed target.
4. Backend returns matching managed detail or historical fallback if id no
   longer matches current settings.

### Opening Historical Identity

1. Evidence or rotation history provides identity id and optional workflow/run/evidence.
2. App opens Identity Lab with historical target.
3. Backend resolves bounded observed fields.
4. Page renders read-only detail.

### Closing Retained Session

1. User invokes close.
2. UI confirms or shows scoped copy.
3. App calls backend close command.
4. App reloads overview.

### Reset Identity

1. User opens reset confirmation.
2. User confirms.
3. App calls backend reset command.
4. Backend rotates identity/settings.
5. App reloads Identity Lab with new managed target.

## State Matrix

### Page States

| State | UI Response |
| --- | --- |
| initial loading | stable header/KPI/list placeholders |
| loaded empty | no managed identities empty state |
| loaded managed selected | list plus managed detail |
| loaded historical selected | list plus historical detail or historical-only context |
| command error | alert region, preserve data |
| refresh pending | refresh state without clearing data |
| stale target | explicit unavailable/read-only state |

### Managed Detail States

| State | UI Response |
| --- | --- |
| retained session active | retained badge, Close action |
| retained session inactive | closed/none badge, no Close action |
| reset allowed | Reset button enabled |
| reset blocked | Reset disabled plus reason |
| no latest observed | empty observed state |
| recent failures | failure badge/attention |
| no evidence | evidence empty state |
| rotation history empty | no rotations state |

### Historical Detail States

| State | UI Response |
| --- | --- |
| workflow known | Open Related Workflow |
| run known | Open Related Run |
| evidence known | Open Related Evidence if callback exists |
| no observed fields | bounded empty state |
| no workflow/run | explain context unavailable |

## Security And Sensitive Data Boundaries

Never render:

- cookies;
- tokens;
- proxy passwords;
- proxy URL credentials;
- browser localStorage/sessionStorage;
- raw profile contents;
- raw profile paths;
- raw font directory paths;
- raw diagnostics payload;
- raw run outputs.

Allowed:

- identity id;
- identity display name;
- workflow name/id;
- run id;
- evidence id;
- profile reuse/session mode label;
- sanitized diagnostics fields;
- approximate profile size;
- sanitized browser identity observed fields.

Do not derive identity posture in renderer from raw run outputs. Use typed
Identity Lab DTOs.

## Accessibility Requirements

Required:

- page has `h1`;
- metrics region has accessible label;
- identity list has accessible label;
- rows are buttons with readable names;
- selected row is conveyed beyond color;
- detail panel has accessible label;
- action buttons have scoped names;
- reset confirmation has clear title/description;
- warning/error messages use status/alert treatment where appropriate;
- definition lists use `dl/dt/dd` or equivalent semantics.

Keyboard:

- list rows reachable;
- refresh reachable;
- detail actions reachable;
- reset dialog confirm/cancel reachable;
- close session confirmation reachable if implemented.

## Layout And CSS Requirements

Follow `DESIGN.md`.

### Desktop Layout

Recommended:

- header;
- KPI grid;
- two-column workspace:
  - identity list;
  - detail.

Detail sections should be stacked, dense, and scannable.

### Compact Desktop

At `1024x768`:

- KPI grid wraps;
- list/detail stack or use reachable layout;
- action bar wraps;
- identity ids truncate/wrap safely;
- definition lists do not overflow;
- rotation history scrolls or wraps.

### Visual Treatment

Use:

- cyan for selected/current;
- green for ready/success only;
- amber for warnings/blockers;
- red for failures/destructive reset;
- monospace for identity/run/evidence ids;
- compact badges and definition lists.

Do not use:

- hero layout;
- decorative nested cards;
- raw gradient/orb backgrounds.

## Component Architecture

### Recommended Split

If implementation grows, split:

```text
src/features/identities/pages/
  IdentityLabPage.tsx
  IdentityLabHeader.tsx
  IdentityMetrics.tsx
  IdentityList.tsx
  ManagedIdentityDetail.tsx
  HistoricalIdentityDetail.tsx
  IdentityActionBar.tsx
  IdentityResetDialog.tsx
  IdentityCloseSessionDialog.tsx
  identityPresentation.ts
  IdentityLabPage.test.tsx
```

Keep `IdentityLabPage` as public page component.

### Presentation Helpers

Pure helpers may own:

- identity title;
- short identity id;
- retained session label/tone;
- reset disabled reason;
- diagnostics labels;
- evidence count label;
- rotation history target construction.

Test helpers if added.

## Error Handling

### Overview Load Error

Show command-facing error.

Preserve existing overview if parent state still has it.

### Close Session Error

Show error near page/action.

Do not change session state optimistically unless command returns success.

### Reset Error

Show error near reset dialog or page alert.

Do not close dialog with false success.

### Stale Identity Target

If managed target no longer matches current settings:

- backend may return historical detail;
- UI must show read-only historical state;
- do not show reset/close.

## Implementation Sequence

Recommended order:

1. Add page tests for current behavior.
2. Add presentation helpers if useful.
3. Improve metrics and list row treatment.
4. Improve managed detail header/action hierarchy.
5. Add/adjust Close Retained Session confirmation/copy.
6. Improve Reset Identity confirmation and disabled reason.
7. Improve historical detail read-only treatment.
8. Improve diagnostics/evidence/rotation sections.
9. Harden responsive CSS.
10. Run focused checks.
11. Update docs only if behavior/contracts changed.

Do not start by changing identity repository unless UI needs a typed field that
cannot be safely derived from existing DTO.

## Test Plan

### Page Tests

Add `src/features/identities/pages/IdentityLabPage.test.tsx`.

Required tests:

- renders loading state;
- renders empty state;
- renders page error;
- renders metrics from counts;
- renders managed identity rows;
- selecting row calls `onSelect` with workflow/identity id;
- selected row is active;
- managed detail shows identity/workflow/posture;
- managed detail does not render raw profile path;
- Open Evidence calls workflow/identity filter callback;
- Open Last Run calls run callback;
- Open Workflow Settings calls workflow settings callback;
- Close Retained Session shown only when available;
- Close Retained Session calls callback with workflow/profileName;
- Reset Identity disabled when `can_reset_identity` false;
- Reset Identity opens confirmation;
- confirming reset calls callback and handles pending state;
- historical detail is read-only;
- historical detail does not show reset/close actions;
- rotation history opens historical target;
- sensitive fixture values are not rendered.

### App Tests

Update `src/App.test.tsx` if navigation changes:

- Evidence identity opens historical Identity Lab target;
- command search managed identity opens managed target;
- Runs detail Open Identity opens managed target;
- reset from Identity Lab reloads target to new identity id;
- close retained session reloads overview.

### Backend Tests

Only if read model changes:

- managed overview search;
- historical detail fallback;
- retained session action availability;
- reset disabled reason;
- safe fields redaction.

### Checks

Run:

- `npm test -- src/features/identities/pages/IdentityLabPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/commands.test.ts` if commands change
- `npm test -- src/AppCss.test.ts`
- `npx tsc --noEmit`

## Manual QA Checklist

Verify:

- open Identity Lab from sidebar;
- refresh overview;
- select managed identity;
- open evidence for identity;
- open last run;
- open Workflow Settings;
- close retained session when active in test state;
- reset identity when allowed;
- see reset disabled when session active;
- open historical identity from Evidence;
- open historical identity from rotation history;
- confirm historical detail has no reset/close;
- resize to `1024x768`;
- confirm no raw profile paths/secrets appear.

## Documentation Requirements

Update docs if implementation changes current truth:

- `docs/domain/user-visible-invariants.md` for identity UI behavior.
- `docs/architecture/frontend.md` for component ownership/navigation changes.
- `docs/contracts/electron-ipc.md` for command changes.
- `docs/contracts/workflow-types.md` for DTO changes.
- `docs/contracts/run-state.md` for retained session behavior.
- `docs/task-routes.md` if checks/routes change.
- `README.md` smoke checklist if identity smoke changes.

If implementation is UI-only and preserves behavior/contracts, state docs did
not need updates beyond this spec.

## Acceptance Criteria

Identity Lab is complete when:

- Managed and historical identities are visually distinct.
- Managed identities show posture, latest observed evidence, diagnostics,
  evidence summary, and rotation history.
- Historical identities are read-only.
- Close Retained Session is scoped and non-destructive.
- Reset Identity is guarded and backend-owned.
- Evidence/Run/Workflow/Workflow Settings links preserve context.
- Raw profile paths, browser storage, proxy credentials, and raw diagnostics are
  not rendered.
- Compact desktop remains usable.
- Focused tests cover changed behavior.

## Agent Handoff Notes

For the coding agent implementing this spec:

- Use TDD because this is user-visible behavior.
- Do not turn Identity Lab into Browser Launch editor.
- Do not expose `profile_dir` or raw profile paths.
- Do not generate identity ids in renderer.
- Keep historical identities read-only.
- Read `DESIGN.md` before CSS changes.
- Update docs only when behavior/contracts change.

