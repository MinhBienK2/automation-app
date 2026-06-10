# Shared Browser Session Identity Design

## Status

Proposed design. Awaiting user review before implementation planning.

## Problem

Workflow Browser Launch currently exposes persistent storage reuse and
fingerprint seed as separate editable controls. That makes it possible to keep
cookies, localStorage, sessionStorage, and login state from one browser identity
while changing the fingerprint seed or nearby launch posture. In account-risk
systems, that can look like the same logged-in account suddenly moved to a
different device.

Operators also need a legitimate way for multiple workflows to use the same
logged-in account session. That should be modeled as several workflows pointing
at the same browser identity/session, not as copying a profile directory from
one workflow into another.

## Goals

- Treat persistent profile storage and fingerprint identity as one atomic
  browser session identity bundle.
- Let a workflow use the project saved session, a private session, or a session
  already used by another workflow in the same project.
- Prevent mismatches where persistent login state survives but the fingerprint
  seed or identity changes underneath it.
- Keep run locking, evidence, deletion, reset, import/export, and diagnostics
  auditable around shared sessions.
- Reuse the existing `project_environments` session rows and workflow
  `environment_id` references where practical.

## Non-Goals

- Cross-project session sharing in the first phase.
- Copying raw browser profile directories between workflows.
- Importing or exporting local browser storage contents.
- Adding in-run graph actions that change the launch identity.
- Replacing action-level cookie/storage nodes for runtime browser context edits.

## Current Model

The current persistence model already has the right foundation:

- `project_environments` stores a browser launch JSON object. Product language
  calls these project saved sessions or private workflow sessions.
- `workflows.environment_id` points at the selected session row.
- Backend `getSettings(workflowId)` normalizes saved Workflow Settings, then
  overlays `browser_launch` from the selected project environment at runtime.
- Run conflict checks already lock active persistent profiles by profile key.

The gap is product semantics and UI control. Browser Launch still presents
fingerprint seed as directly editable, and lifecycle operations are not framed
as operations on a shared identity bundle.

## Core Concept

A browser session identity bundle is the durable launch identity that one or
more workflows can reference. It contains:

- `identity_id`
- `profile_dir`
- `profile_name` when persistent storage reuse is enabled
- `fingerprint_seed`
- persona and fingerprint fonts
- proxy, timezone, locale, GeoIP, WebRTC, humanize, and headless posture
- persistent profile storage under the app browser profile directory

The bundle, not an individual workflow, owns the browser identity. A workflow
chooses which bundle to use. When multiple workflows choose the same bundle,
they share both the login state and the fingerprint identity.

## Scope Decision

Version 1 supports sharing only within the same project. A workflow can select
another same-project workflow's browser session. Internally that means assigning
the current workflow to the same project environment row as the source workflow.

Cross-project sharing is deferred because it needs separate ownership,
permission, deletion, package import/export, and stale-reference rules.

## User Experience

Workflow Settings Browser Launch should be reframed around session source.

Primary control:

```text
Session source
- Project saved session
- Private session for this workflow
- Use session from another workflow
- Fork current session
```

When `Use session from another workflow` is selected, the picker lists
same-project workflows with session metadata:

- workflow name
- session name
- identity id
- persistent or temporary state
- last run or last observed evidence timestamp when available
- active run or retained session state
- number of workflows using the same session

The UI should make clear that this links to the same session bundle. It should
not say that the app copies a profile.

When a shared session is selected, Browser Launch identity fields are read-only
from the workflow dialog unless the operator opens the owning session editor.
The dialog should show a small sharing summary such as:

```text
Shared with 3 workflows in this project.
Changes to this session identity affect all linked workflows.
```

## Session Lifecycle

### Create Workflow

Existing create choices remain, but labels should match the new model:

- Use project saved session.
- Create private session for this workflow.
- Use existing session from another same-project workflow.

The default remains project saved session.

### Link Existing Workflow To Another Session

Selecting a session source updates the workflow's `environment_id` to the
selected project environment id. The workflow's graph, run policy, graph
defaults, and environment variables remain workflow-local.

No browser launch fields are copied into the workflow as authoritative data.
Compatibility settings may still carry a snapshot, but runtime must resolve the
selected session row.

### Fork Session

Forking creates a new project environment row with a new backend-generated
identity id, profile dir, and fingerprint seed. It copies non-storage launch
preferences such as proxy, timezone, locale, GeoIP, WebRTC, fonts, humanize, and
headless policy.

Forking does not copy browser storage. The fork starts with a fresh profile.

### Reset Or Rotate Identity

Reset identity operates on the selected session bundle, not silently on a single
workflow. If more than one workflow references the bundle, the confirmation must
say how many workflows are affected and list at least the first few names.

Reset identity creates a new identity id, profile dir, and fingerprint seed. It
preserves non-storage launch preferences. Run from selected becomes disabled for
affected workflows until a fresh retained session exists.

### Manual Fingerprint Seed Editing

Persistent browser identities should not expose normal direct fingerprint seed
editing in Workflow Settings. The default operation is reset or fork.

If an advanced/manual seed edit remains available for lab work, it must be
guarded:

- unavailable while any active run or retained session uses the bundle
- blocked when the persistent profile directory contains local browser storage,
  unless the operator chooses to clear storage or fork a new session
- recorded in migration notes as an identity mutation
- surfaced as a high-risk action in UI copy

The preferred v1 behavior is to remove direct seed editing from workflow-level
Browser Launch and keep reset/fork as the normal route.

### Delete Workflow

Deleting a workflow must not delete shared browser profile data when other
workflows still reference the same session bundle.

If the workflow is the only user of a private session, deletion can keep the
existing choice to delete that private profile data by default. If the session
is shared, the delete dialog should show that profile data is retained because
other workflows use it.

### Delete Session Bundle

Deleting a session bundle is allowed only when no workflows reference it, no
active run owns its profile, and no retained session owns its profile. Project
deletion can still delete contained sessions after the same active-run and
retained-session guards pass.

## Runtime Behavior

Run execution resolves Browser Launch from the selected session bundle before
browser launch. Because shared workflows point to the same bundle row, they use
the same `profile_dir`, `fingerprint_seed`, and launch posture.

Concurrent runs that share a persistent profile remain disallowed. Existing
active profile conflict behavior should continue to reject the second run with a
readable error.

Run from selected remains available only when:

- the workflow uses a persistent session bundle
- browser retention is `retain`
- a retained session exists for the same workflow/profile key
- the selected graph node is eligible

If multiple workflows share a session, retained-session ownership must stay
specific enough to avoid accidentally running workflow B's selected node against
workflow A's retained page unless product explicitly supports that later.
Version 1 should keep retained sessions keyed by workflow/profile and require
the workflow to create its own retained session.

## Evidence And Diagnostics

Run evidence should include enough metadata to audit shared identity usage:

- `identity_id`
- session/environment id
- session display name
- profile dir or `temporary`
- session mode
- fingerprint seed hash, not the raw seed
- number of linked workflows when known
- source label, such as project saved session, private session, or shared session

Diagnostics should continue to avoid raw cookies, localStorage, sessionStorage,
proxy passwords, and raw profile storage values.

## Import, Export, And Duplicate

Workflow duplicate should default to a fresh session identity, preserving the
current safety behavior. Add an explicit option later to keep the duplicate
linked to the same session.

Workflow package import should not link to an existing project saved session
unless the user explicitly selects one. Imported workflows that include settings
should get fresh identity/profile values, as today, unless a future import UI
adds a deliberate session-linking step.

Project import/export can preserve relationships between workflows and sessions
inside the package while still generating fresh local identity/profile values on
import. Browser storage contents remain excluded.

## Backend Changes

The implementation should favor reference updates over data copies:

- Add a command for changing a workflow's selected session source.
- Reuse `assignWorkflowProjectEnvironment` for same-project session linking.
- Add query helpers for session usage counts and workflows linked to a session.
- Guard reset, seed mutation, deletion, and cleanup using session usage and
  active profile/retained session state.
- Keep runtime `getSettings()` resolving Browser Launch from the selected
  session row.
- Ensure package services preserve or regenerate session references according to
  import/export rules.

## Frontend Changes

- Replace the current Browser Launch identity controls with a session source
  picker and read-only identity summary for shared sessions.
- Keep editable run policy, graph defaults, and workflow environment variables
  workflow-local.
- Add fork/reset actions with clear confirmation dialogs.
- Show sharing count and active session state in Workflow Settings and Identity
  Lab.
- In create workflow and duplicate workflow flows, expose safe choices without
  making raw profile directories visible.

## Validation And Error Handling

Errors should be explicit:

- shared profile already active
- retained session must be closed before identity reset
- cannot delete profile because other workflows use it
- cannot link to a session outside the selected project in v1
- cannot mutate fingerprint seed for a persistent profile with existing storage
  unless using guarded advanced flow

Validation should reject persistent identities without a fingerprint seed, but
normal users should not be forced to manage the seed directly.

## Testing

Focused tests should cover:

- creating a workflow that links to an existing same-project session
- runtime settings resolution uses the shared session row, not stale workflow
  snapshots
- two linked workflows cannot run concurrently on the same persistent profile
- reset shared identity warns/affects all linked workflows and updates one
  shared session row
- deleting one linked workflow preserves shared profile data
- duplicating a workflow defaults to a fresh identity/session
- evidence records session id/source metadata without raw secrets or storage
- import/export remaps session references and does not import browser storage

## Migration

Existing workflows already have `environment_id` where available. Migration
should preserve those links. Workflows without an environment should be assigned
to the default project saved session or a generated private session according to
the existing lazy default behavior.

No browser profile directories should be moved during migration.

## Open Decisions

- Whether advanced manual seed editing is removed entirely or hidden behind a
  guarded lab-only control.
- Whether a future phase should support cross-project session sharing through a
  global identity registry.
- Whether retained browser sessions should ever be shareable across workflows or
  remain workflow/profile keyed only.
