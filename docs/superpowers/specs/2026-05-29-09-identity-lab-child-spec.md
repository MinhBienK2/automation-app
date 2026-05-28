# Mission Control UI/UX Upgrade Child Spec 09: Identity Lab

Date: 2026-05-29

## Status

Approved design direction, drafted for user review.

This child spec follows the master UI/UX upgrade spec and child specs 01-08.
It owns the current and historical browser identity workspace.

## Brainstorming Decisions

Question: should Identity Lab become an identity editor?

Approved answer: no. Identity editing belongs in Workflow Settings Browser
Launch. Identity Lab is for posture, diagnostics, retained-session action,
history, and traceability.

Question: should historical identities be interactive like current identities?

Approved answer: no. Historical identity references are read-only evidence
context. They can link to related run/workflow/evidence but cannot be reset or
closed.

Question: what should be safest?

Approved answer: Reset Identity and Close Retained Session must be guarded,
clearly scoped, and must never imply profile data deletion.

## Goal

Turn Identity Lab into a clear operations workspace for understanding browser
identity posture, active retained sessions, diagnostics, evidence context, and
identity rotation history.

The implementation must:

1. Distinguish managed current identities from historical evidence references.
2. Show configured posture, latest observed evidence, diagnostics, retained
   session status, and rotation history.
3. Keep Reset Identity and Close Retained Session guarded and scoped.
4. Link safely to Evidence, Runs, Workflow Detail, and Workflow Settings.
5. Avoid raw profile paths, cookies, browser storage, proxy credentials, and
   raw diagnostics.

## Inputs And Sources Of Truth

Read before implementation:

- `docs/README.md`
- `docs/task-routes.md`
- `DESIGN.md`
- `docs/domain/user-visible-invariants.md`
- `docs/domain/workflow-lifecycle.md`
- `docs/domain/execution-semantics.md`
- `docs/contracts/electron-ipc.md`
- `docs/contracts/run-state.md`
- `docs/architecture/frontend.md`
- Workflow Settings child spec
- Evidence Explorer child spec

Visual reference:

- `.stitch/designs/2026-05-28-12-polished-05-identity-lab.html`

Primary source files:

- `src/features/identities/pages/IdentityLabPage.tsx`
- `src/App.tsx`
- `src/lib/workflowApi.ts`
- `src/types/workflow.ts`
- `src/styles/workflows.css`
- `src/styles/layout.css`
- `electron/backend/identity/identityRepository.ts`
- `electron/backend/commands.ts`
- `electron/backend/browser/sessionManager.ts`

Likely tests:

- add `src/features/identities/pages/IdentityLabPage.test.tsx`
- `src/App.test.tsx`
- `src/lib/workflowApi.test.ts`
- `electron/backend/commands.test.ts` if command behavior changes
- identity repository tests if read model changes

## Scope Boundaries

### In Scope

- Identity page layout.
- Managed identity list.
- Detail posture sections.
- Historical read-only detail.
- Retained session close UX.
- Reset identity confirmation UX.
- Diagnostics presentation.
- Rotation history presentation.
- Cross-workspace links.
- Empty/loading/error states.

### Out Of Scope

- Editing Browser Launch fields.
- Creating identities outside workflows.
- Deleting profile data.
- Showing raw browser profile paths.
- Showing cookies, localStorage, sessionStorage, or proxy secrets.
- Replacing Workflow Settings identity reset command.

## Layout Requirements

Identity Lab should use:

- Header with refresh and last refreshed metadata.
- KPI strip for managed identities, retained sessions, and recent failures.
- Left identity list.
- Right detail panel.

At compact desktop, detail can stack below list, but current selection must stay
clear.

## Managed Identity List Requirements

Each row shows:

- display name or identity id;
- workflow name;
- retained-session status;
- latest run status summary when available;
- attention marker for recent failure or diagnostic warning.

Rows must avoid raw profile paths. Use identity id and workflow name as the
stable reference.

Selection:

- selecting a row loads/opens managed detail;
- focused target from Evidence/Overview should select the matching identity or
  show a stale/unavailable state.

## Managed Detail Requirements

Detail header:

- identity display name;
- workflow name;
- identity id in monospace;
- current/historical marker.

Action bar:

- Open Evidence.
- Open Last Run when available.
- Open Workflow.
- Open Workflow Settings.
- Close Retained Session when backend says available.
- Reset Identity when backend says available.

Configured Posture section:

- persona label/rationale if available;
- browser/storage mode;
- proxy status without credential leakage;
- GeoIP/timezone/locale summary;
- humanize status/preset;
- headless status;
- fingerprint font status summary.

Latest Observed section:

- latest run id;
- bounded observed browser identity fields;
- source/time metadata;
- no raw action output blob.

Diagnostics section:

- binary installed/version;
- GeoIP availability;
- headed display readiness;
- font status;
- profile count/status if safe;
- smoke readiness if present.

Evidence section:

- total matching evidence count;
- last evidence timestamp when available;
- Open Evidence action with workflow/identity filter.

Rotation History section:

- old identity id;
- new/current identity id when available;
- migration message;
- timestamp;
- link to historical reference when old identity exists.

## Historical Detail Requirements

Historical detail is read-only.

Show:

- identity id;
- related workflow/run/evidence context when available;
- observed fields;
- warning that it is no longer attached to current workflow settings.

Allowed actions:

- Open Related Run.
- Open Related Workflow.
- Open Related Evidence if target is available.

Forbidden actions:

- Reset Identity.
- Close Retained Session.
- Edit settings for the historical identity itself.

## Guarded Actions

Close Retained Session:

- must name workflow and profile/session scope without exposing raw profile path;
- explains it closes only in-memory retained browser context;
- must state it does not delete profile data, cookies/login state, workflow
  settings, evidence, or historical runs;
- calls `closeIdentityRetainedSession`.

Reset Identity:

- uses the same backend command as Workflow Settings;
- confirmation names workflow and current identity id;
- explains new identity id/profile/fingerprint seed will be generated;
- explains historical evidence remains unchanged;
- disabled/blocking reason is shown when active run/retained session prevents it.

## Cross-Workspace Navigation

Identity Lab must support:

- Evidence identity link -> historical or managed target.
- Run detail -> managed identity when current identity exists.
- Identity -> Evidence filtered by workflow/identity.
- Identity -> Runs focused on latest/related run.
- Identity -> Workflow Settings Browser Launch for current workflow.

Stale target handling:

- show requested identity id;
- explain whether it is unavailable or historical-only;
- offer safe fallback actions when possible.

## Security And Sanitization Requirements

Never render:

- cookies;
- tokens;
- proxy passwords;
- raw proxy URL credentials;
- browser local/session storage;
- raw profile contents;
- arbitrary local filesystem paths;
- raw diagnostic payloads.

Renderer must not derive identity posture from raw run outputs. Use typed
identity read models and sanitized evidence fields only.

## CSS And Responsive Requirements

Follow `DESIGN.md`.

At `1024x768`:

- KPI strip wraps without overlap;
- list/detail remain reachable;
- long identity ids truncate/wrap safely;
- action buttons wrap into stable rows;
- definition lists do not overflow.

## Tests And Checks

Required focused tests when implemented:

- Loading, empty, and error states render.
- Managed row selection calls `onSelect`.
- Managed detail shows posture without raw profile path.
- Open Evidence/Run/Workflow/Settings callbacks use correct ids.
- Close Retained Session action is shown only when available.
- Reset Identity confirmation opens, confirms, and disables while pending.
- Historical detail is read-only and lacks reset/close actions.
- Stale/unavailable targets render explicit state.
- Sensitive raw fields from fixtures are not rendered.

Run checks:

- `npm test -- src/features/identities/pages/IdentityLabPage.test.tsx`
- `npm test -- src/App.test.tsx`
- `npm test -- src/lib/workflowApi.test.ts` if wrappers change
- `npm test -- electron/backend/commands.test.ts` if command behavior changes
- `npx tsc --noEmit`

## Acceptance Criteria

- Operators can understand current identity posture without opening Workflow
  Settings.
- Reset and retained-session close are guarded, scoped, and non-destructive.
- Historical identities are clearly read-only.
- Evidence, run, workflow, and settings links preserve context.
- Sensitive identity/runtime data remains hidden.

