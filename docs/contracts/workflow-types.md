# Workflow Type Contracts

## Source Files

- TypeScript: `src/types/workflow.ts`
- Shared persona catalog: `src/lib/personaCatalog.ts`
- Electron bridge: `src/types/electron.ts`
- Node command handlers: `electron/backend/commands.ts`
- Workflow Settings service: `electron/backend/services/workflowSettingsService.ts`
- Workflow package service: `electron/backend/services/workflowPackageService.ts`
- TypeScript graph compiler: `electron/backend/graph/compiler.ts`
- CloakBrowser runner: `electron/backend/runtime/runner.ts`
- SQLite repository: `electron/backend/persistence/workflowRepository.ts`

## Workflow Shapes

Frontend and backend must agree on:

- `Project`: `id`, `name`, optional description, default flag, timestamps.
- `ProjectEnvironment`: compatibility DTO for project saved sessions and
  private workflow sessions with `id`, `project_id`, `name`, optional
  description, `is_default`, `browser_launch`, and timestamps. The renderer
  exposes the default row as a single project saved session rather than a full
  Project Environment editor.
- `WorkflowSummary`: `id`, `project_id`, `environment_id`, optional
  `environment_name`, `name`, `step_count`, `created_at`, `updated_at`.
- `Workflow`: `id`, `project_id`, `environment_id`, `name`, `created_at`,
  `updated_at`.
- `WorkflowDetail`: workflow metadata, while the product UI loads graph authoring data through `get_workflow_graph`.
- `WorkflowSettings`: per-workflow aggregate loaded through `get_workflow_settings`, with `general`, `run_policy`, `browser_launch`, `graph_defaults`, and `environment` sections.
- `WorkflowGraph`: `version`, `nodes`, `edges`, `viewport`.
- `Subflow`: project-scoped reusable graph fragment with `id`, `project_id`,
  `name`, optional description, `graph`, and timestamps.
- `SubflowSummary`: subflow list DTO with `used_by_count`.
- `SubflowUsage`: workflows that reference a subflow through Call Subflow
  nodes.
- `GraphNode`: `id`, `node_type`, `label`, `position`, `config`, `ports`, optional `group_id`.
- `GraphEdge`: `id`, `source_node_id`, `source_port`, `target_node_id`, `target_port`, optional `label`, optional `condition`, optional `delay`.
- `CompiledWorkflowGraph`: `steps`, where each compiled step carries `node_id`, `label`, and `config`, plus optional `domain_policy` with allowed domains resolved from graph allowlist nodes.
- `RunState.retained_session`: optional retained browser session availability metadata used by debug run-from-selected UI.
- `WorkflowRunSnapshot`: run-id scoped status wrapper with `run_id`, `workflow_id`, `workflow_name`, `source` (`manual` or `schedule`), `started_at`, and nested `state: RunState`, plus mirrored top-level run-state fields for compatibility.
- `MissionControlTarget`: renderer-only typed navigation target for Overview,
  Workflow, Evidence, Identity Lab, Schedule, and graph issue focus.
- `OperationsOverviewRequest`: local-day UTC range capped at 48 hours plus
  optional bounded list limits and attention filters for the Overview read
  model.
- `OperationsOverview`: backend-owned dashboard DTO with metrics, live runs,
  unified attention, activity buckets, recent evidence metadata, upcoming
  schedules, and data warnings. Recent evidence result pages remain bounded
  after the backend has matched persisted evidence metadata; newer output-only
  run rows must not hide older evidence items.
- `EvidenceListRequest`: evidence filters for search, type, run status,
  durable source, workflow, run, historical identity, time range, cursor, limit,
  and optional focused evidence id. Result pages remain bounded, but matching
  persisted run outputs are not capped to the newest rows before filtering.
- `EvidencePage`: backend-owned evidence result page with typed list items,
  opaque cursor, `has_more`, and skipped-item warning counts.
- `EvidenceDetail`: one typed safe payload for screenshot, download, browser
  identity, action trace, or evidence manifest evidence.
- `EvidenceScreenshotPreview`: validated screenshot preview payload containing
  PNG base64 data only after backend path/file checks.
- `EvidenceBundleExportRequest` / `EvidenceBundleExportResult`: explicit
  selected evidence bundle export request and manifest-bundle result.
- `IdentityLabTarget`: managed identity target by current `workflow_id` plus
  `identity_id`, or historical identity reference by `identity_id` with
  optional workflow/run/evidence context.
- `IdentityLabOverviewRequest`: bounded Identity Lab search, selected target,
  and list/rotation limits.
- `IdentityLabOverview`: backend-owned Identity Lab DTO with current managed
  identity summaries, selected detail, counts, and data warnings.
- `ManagedIdentitySummary`: one workflow-owned current browser identity row
  with workflow/identity refs, session/profile reuse, retained-session state,
  configured posture summary, last matching run, recent failure count, and
  warning badges.
- `IdentityLabDetail`: either a managed identity detail with configured
  posture, latest observed browser identity evidence, matching run/evidence
  summary, rotation history, sanitized diagnostics, and action availability,
  or a read-only historical identity reference with safe source context.
- `WorkflowPackage`: product-facing import/export JSON with `kind:
  "workflow_package"`, `version: 2`, workflow name metadata,
  `included_sections`, `omitted_fields`, optional `flow`, optional partial
  `settings`, and optional referenced `subflows`.
- `WorkflowSchedule`: persisted schedule DTO with workflow id/name, schedule name, enabled state, kind, next run time, last event summary, and timestamps.
- `WorkflowScheduleEvent`: persisted scheduler audit event for started, skipped, missed, failed-to-start, and disabled decisions.
- `RecordingSession`: backend-owned recorder lifecycle DTO with session id,
  optional workflow id, mode, status, timestamps, sanitized browser identity
  metadata, sanitized Workflow Settings snapshot, page URL, event count, and
  warnings.
- `RecordingEvent`: ordered browser-recording event DTO with kind, page/frame
  URLs, target metadata, captured value, bounded raw diagnostics, confidence,
  and warnings. Recorder event capture currently fills an in-memory event list
  through backend-owned browser instrumentation and page-side capture.
- `ReviewedRecordingStep`: normalized recorder step DTO with source event ids,
  an existing `ActionConfig`, label, inclusion flag, locator confidence, and
  review warnings. Graph draft generation consumes these steps instead of raw
  browser events.
- `RecordingSaveDraftInput`: reviewed recorder save payload with workflow name,
  explicit save mode, reviewed steps, and terminal success preference.

## Workflow Settings Shape

Workflow Settings are persisted separately from graph JSON. Browser Launch
inside Workflow Settings is the saved selected-session overlay returned to
legacy callers; workflow execution resolves Browser Launch from the workflow's
selected project saved session or private workflow session:

```text
{
  workflow_id: string,
  version: 2,
  general: { name, description, tags, notes, created_at, updated_at },
  run_policy: {
    max_workflow_duration_ms,
    browser_retention,
    execute_js_enabled,
    run_from_selected_enabled,
    run_from_selected_mode: "selected_only" | "from_selected",
    batch_concurrency_limit,
    batch_headless,
    batch_stop_on_first_failed_row
  },
  browser_launch: {
    session_mode,
    identity_id,
    display_name,
    persona_id,
    persona: {
      id,
      label,
      rationale,
      os_bucket,
      browser_channel_bucket,
      viewport: { width, height },
      window: { width, height },
      timezone,
      locale,
      proxy_geo_policy,
      proxy_region,
      webrtc_mode,
      font_bundle: { label, path, expected_families },
      account_label,
      test_account_binding,
      behavioral_timing_profile
    },
    profile_dir,
    fingerprint_seed,
    profile_name,
    fingerprint_fonts_dir,
    timezone,
    locale,
    geoip,
    proxy_bypass,
    webrtc_policy,
    webrtc_ip,
    proxy_enabled,
    proxy_server,
    proxy_username,
    proxy_password,
    headless,
    humanize,
    human_preset
  },
  graph_defaults: {
    default_edge_delay: null
      | { type: "fixed", duration_ms }
      | { type: "random", min_ms, max_ms },
    live_run_enabled: boolean,
    live_run_follow_current: boolean
  },
  environment: { initial_variables },
  migration_notes: [{ path, action, message }]
}
```

`identity_id` and `profile_dir` are stable storage identifiers; `display_name` is operator-editable metadata. New and rotated backend-owned identities use high-entropy `bi_<32 hex>` ids. `fingerprint_seed` is generated when an identity is created, deterministically derived from the identity id for backend rotations, collision-probed against other saved workflow and project-session seeds, and reused until the operator resets the identity or edits a project saved-session seed. `profile_name` mirrors `profile_dir` for persistent-profile runs. `persona_id` selects a stable catalog persona, and `persona` stores the resolved OS/browser bucket, viewport/window dimensions, timezone/locale metadata, proxy/geo policy, WebRTC mode, font bundle metadata, account label/test account binding, and behavior timing profile for that workflow identity. `timezone` and `locale` are explicit operator overrides; new workflow defaults enable GeoIP, so blank values remain omitted and CloakBrowser resolves them from the current public or proxy exit IP. Blank legacy values also normalize back to GeoIP. To run with GeoIP disabled, the identity should carry explicit timezone and locale values. `src/lib/personaCatalog.ts` is the shared catalog source used by frontend defaults and backend normalization. `fingerprint_fonts_dir` is an optional local readable directory passed to CloakBrowser as the managed font inventory for the launch identity. New or lazy backend defaults use the repo-local `.local/cloakbrowser-fonts/linux` directory when it exists and is readable; an explicit saved `null` remains cleared, and persona font bundle paths are still used when selected persona defaults provide one and no explicit directory is set. Package export removes this local absolute path.

Proxy credentials can be provided as URL credentials or separate
username/password fields, but not both. Package export removes proxy passwords
proxy URL credentials, and local fingerprint font directories. Raw Chromium
argument text and ad hoc fingerprint override fields are not part of the public
settings contract.
CloakBrowser humanization defaults to `true` and is persisted as the Browser Launch `humanize` toggle. `human_preset` maps to CloakBrowser `humanPreset` and accepts `default` or `careful`, with invalid or missing persisted values normalized through the selected persona timing profile.

Settings validation issues serialize as `{ section, field, message, level }`.
Run validation issues serialize as `{ source, field, node_id, edge_id, message, level }`.
Workflow exports include optional `settings`; imports without settings are valid flow-only packages.
Run Policy `execute_js_enabled` defaults to true for authorized test profiles. When it is false, the runner rejects `execute_js` / Run JavaScript actions before evaluating script text and returns a clear failed step error. Run Policy batch fields remain part of the current contract for backend batch execution, but Workflow Settings currently renders those batch controls as visible, disabled values until Batch Run UI is ready.
Graph `live_run_enabled` defaults to true for new or lazily normalized settings and controls whether workflow detail renders the Live Run navigator. `live_run_follow_current` defaults to false, is only meaningful when Live Run is enabled, and controls whether active run progress automatically follows the current graph node. Graph default link wait is an authoring default only. It is copied onto newly created graph links and does not rewrite existing links.

## Workflow Package Shape

Workflow Package v2 is the current user-facing import/export format. It is graph-first:

```text
{
  kind: "workflow_package",
  version: 2,
  workflow: { name },
  included_sections: ["flow", "settings.general"],
  omitted_fields: ["settings.browser_launch.proxy_password"],
  flow: WorkflowGraph | null,
  subflows: [
    { id, project_id, name, description, graph }
  ],
  settings: {
    general,
    run_policy,
    browser_launch,
    graph_defaults,
    environment
  } // every section optional
}
```

Package export options serialize as `{ include_flow, settings_sections }`,
where `settings_sections` contains Workflow Settings section ids. Package
import options serialize as `{ include_flow, settings_sections,
target_project_id? }`, always create a new workflow in the target project, and
remap selected settings to the new workflow id.

Package preview serializes as `{ workflow_name, includes_flow,
settings_sections, omitted_fields }`. Preview is the UI review point before
import. Package import validates selected flow/settings and packaged subflows
before creation and saves workflow, recreated subflows, graph, settings, and
any private imported session in one SQLite transaction so failed imports do not
leave orphan workflows.

When Flow includes Call Subflow nodes, export includes each same-project
referenced subflow in `subflows` and adds `subflows` to `included_sections`.
Import recreates those subflows in the target project and remaps Call Subflow
`subflow_id` values in the imported graph before saving it.

When Browser Launch is selected during import, the backend creates a private
imported workflow session and saves the sanitized package Browser Launch values
there. Imports that omit Browser Launch use the target project's saved session
without rewriting it.

Export sanitizes machine-local or sensitive fields by default: `settings.browser_launch.proxy_password`, credentials embedded in `settings.browser_launch.proxy_server`, and local `settings.browser_launch.fingerprint_fonts_dir`.

`BrowserProfileDiagnostics` reports profile directory, identity/workflow
metadata, bounded approximate size, last modified time, last run time, and active-session
status. The profile size walk is capped by diagnostics traversal limits so common diagnostics do not block on very large Chromium profiles. `BrowserProfileCleanupResult` reports deleted orphan profile directories,
skipped referenced or active profiles, and reclaimed bytes.
`CloakBrowserDiagnostics` also reports real fingerprint font diagnostics and
last smoke result status. Font diagnostics are `not_configured`,
`ok`, `warning`, or `error`; configured directories report file count, total
bytes, normalized content hash, expected family coverage, missing families, and
the workflow identities sharing each directory.

`WorkflowDeleteOptions` serializes as `{ deleteBrowserProfile?: boolean }`.
At the command boundary, omitting `deleteBrowserProfile` keeps profile data.
The workflow list confirmation checks Delete private browser profile data by
default and sends `deleteBrowserProfile: true` unless the operator unchecks it.
Deletion is rejected while the workflow has an active run, while its persistent
profile is owned by an active run, or while a retained session still owns the
workflow/profile. When `deleteBrowserProfile` is true, the backend removes only
the deleting workflow's private profile directory; shared or active-session
profile directories are retained.

`resetWorkflowBrowserIdentity` is the command boundary for operator-triggered identity rotation. It returns the persisted Workflow Settings after replacing `identity_id`, `profile_dir`, `profile_name` when persistent sessions are enabled, and `fingerprint_seed`; copied preferences such as persona, proxy bypass, locale/timezone, humanization, and `fingerprint_fonts_dir` are preserved, `run_policy.run_from_selected_enabled` is reset to false, and a `migration_notes` entry records old/new identity evidence.

`resetProjectEnvironmentBrowserIdentity` is the command boundary for project saved-session identity rotation. After UI confirmation, it returns the updated project environment after replacing `identity_id`, persistent profile fields, and `fingerprint_seed`, while preserving non-storage Browser Launch preferences and deleting the old unshared local project profile directory.

`createProject` returns the created `Project` after trimming a non-empty
project name and also persists that project's default saved session plus an
initial draft workflow named `Main`. `updateProject` returns the updated
`Project` after trimming non-empty project names. `duplicateProject` returns the newly created `Project` after copying
project environments, subflows, workflows, workflow graphs, and settings into a
new project with remapped copied subflow references and fresh browser identity
storage values. `deleteProject` returns no payload; it removes the project and
its contained workflows/subflows/sessions after command guards pass.

Local workflow duplication is not a workflow package export. The `duplicate_workflow` command copies the saved graph and non-storage Workflow Settings to a new workflow id, including local fields that package export sanitizes for external sharing. Browser Launch gets a fresh backend-generated `identity_id`, `profile_dir`, `profile_name` when persistent sessions are enabled, and `fingerprint_seed`; copied preferences such as persona and `fingerprint_fonts_dir` are preserved, and `run_policy.run_from_selected_enabled` is reset to false so the copy cannot reuse the source retained session.

## Batch Run Shape

`BatchRunRequest` serializes as:

```text
{
  rows: Array<Record<string, string>>,
  concurrency_limit?: number | null,
  headless?: boolean | null
}
```

When `concurrency_limit` or `headless` is omitted, the backend uses Workflow Settings Run Policy defaults. Concurrency values above 1 are rejected until rows can run in isolated browser/session contexts.
Those Run Policy defaults are still honored by `run_batch_workflow`; the current Settings UI shows them as paused, read-only controls rather than editable Run Policy fields.

## Schedule Shape

`WorkflowScheduleInput` serializes as:

```text
{
  workflow_id: string,
  name: string,
  enabled: boolean,
  kind:
    | { type: "once_at", timestamp: string }
    | { type: "interval", every_seconds: number }
    | { type: "calendar", preset: "daily", time: "HH:mm" }
    | { type: "calendar", preset: "weekly", weekdays: number[], time: "HH:mm" }
    | { type: "calendar", preset: "monthly", day: number, time: "HH:mm" }
}
```

`WorkflowSchedule` adds `id`, `workflow_name`, `next_run_at`,
`last_event_at`, `last_status`, `last_reason`, `created_at`, and `updated_at`.
`next_run_at` and event timestamps are ISO strings; UI displays them in local
time.

`WorkflowScheduleEvent` serializes scheduler decisions as:

```text
{
  id: string,
  schedule_id: string,
  workflow_id: string,
  event_type: "started" | "skipped" | "missed" | "failed_to_start" | "disabled",
  run_id: string | null,
  scheduled_for: string,
  created_at: string,
  reason: string | null,
  details_json: string | null
}
```

Schedule validation issues serialize as `{ field, message, level }`.
Enabled schedules must have valid schedule config and a currently runnable
saved workflow. Disabled draft schedules can be saved without requiring the
workflow graph/settings to be runnable.
Scheduler skip reasons include workflow/profile/batch run conflicts such as
`active_workflow`, `active_profile`, and `active_batch`; isolated due schedules
can start concurrently and each started event records its run id.

## Recording Shape

Recorder session commands serialize as:

```text
startRecordingSession({
  mode: "new_workflow" | "replace_current_graph",
  workflow_id?: string | null,
  workflow_name?: string | null,
  initial_url?: string | null,
  browser_launch_overrides?: { headless?: boolean } | object | null
}) -> RecordingSession
```

`new_workflow` starts from a backend-owned unsaved Workflow Settings draft with
a fresh browser identity and `workflow_id: null` on the public session.
`replace_current_graph` starts from the existing workflow's saved Workflow
Settings and returns the workflow id on the public session. It rejects active
workflow, active profile, and active batch conflicts before launch. Public
`workflow_settings_snapshot` values are sanitized for renderer display; the
backend retains the internal settings snapshot for later save phases. Starting a
session launches the recorder browser in the backend, injects capture before
optional `initial_url` navigation, and records top-level navigation events from
the page adapter while ignoring embedded frame navigations. `browser_launch_overrides.headless` is applied to the recorder settings
snapshot for deterministic headless verification; unsupported override keys are
reported as warnings and ignored. Page-side capture buffers events when the
adapter binding exists but cannot call back into the backend, and the backend
poller drains that buffer into the session event stream. Stopping a recorder
session also drains the buffer before closing the browser context.

`RecordingBrowserIdentitySnapshot` includes `identity_id`, display/profile
metadata, a `fingerprint_seed_hash` rather than the raw seed, persona metadata,
humanization settings, and headless state. Proxy passwords and proxy URL
credentials must not be sent to renderer code in recorder snapshots.

`RecordingEvent.kind` currently allows navigation, click, input/change/select,
checkbox/radio, clipboard, scroll, keyboard, download, dialog, tab, and
wait-marker events. Capture records navigation, click variants, literal text
entry including empty strings and surrounding whitespace, contenteditable editor
text, select, checkbox/radio, clipboard copy/paste, file-input change names,
throttled scroll, non-text keys/hotkeys, form submit markers,
tab creation/switch, downloads, and dialogs. Capture drops malformed
locator candidates, bounds locator strings, bounds raw page-controlled payloads,
and redacts password or secret-like text field values before events are returned
through IPC. Raw payload fields with secret-like keys are redacted even when a
page calls the recorder binding directly. Redacted input events carry a
`sensitive_input_redacted` warning and `raw.value_redacted` marker. Unsupported
captured behavior must become `RecordingWarning` entries rather than silently
producing graph nodes.

The recorder normalizer collapses repeated input/change events for the same
target into one `input_text` step with the final value, maps navigation, click
variants, select, checkbox/radio, clipboard paste, scroll, keyboard, tab, download, dialog,
wait-marker, screenshot-marker, submit-marker, and reviewed upload-path events
into existing action configs, ignores text-composition and modifier-only
keyboard noise such as `Process`/`Shift`, text edit hotkeys, and deletion keys
so they do not split text entry, ignores generic clicks superseded by form
control events on the same target, turns paste into Set Clipboard followed by
Paste Clipboard while dropping the following duplicate input event on the same
target, treats click-caused tab creation as a subsequent tab switch, resets
scroll deltas after navigation/tab changes, and
carries source event ids forward for review.
Each reviewed step also carries first/last source-event timestamps; graph
generation turns positive gaps between included recorded steps into fixed
duration edge delays so normal graph runs preserve the operator's recorded
pacing between actions.
Sensitive redacted input steps are generated with an empty value, excluded by
default, and must be reviewed with a safe literal or variable before replay.
Native file chooser captures only expose file names; generated `upload_file`
steps remain excluded and carry `upload_requires_reviewed_file_path` until a
reviewer supplies explicit local file paths. Locator generation prefers
`test_id`, role/name, labels, placeholders, short text, attributes, CSS, and
XPath in that order. Low-confidence locator output remains draftable but adds a
`weak_locator` review warning.

`RecordingWorkflowDraft` is a review-only backend-memory draft. It contains the
session id, optional workflow id, recorder mode, generated timestamp, sanitized
Workflow Settings snapshot, normalized `ReviewedRecordingStep[]`, generated
`WorkflowGraph`, graph validation issues, and aggregate warnings. Draft
generation does not create workflow rows, persist Workflow Settings, or replace
an existing graph. The generated graph uses the normal v2 graph shape:
`Start -> recorded action nodes -> optional End Success`, with deterministic
row-wrapped positions for long recordings, fixed edge delays for captured
operator pacing between included steps, and ordinary action node configs.

Draft save commands serialize as:

```text
saveRecordingDraft(draftId, {
  workflow_name: string,
  save_mode: "create_new" | "replace_graph",
  reviewed_steps: ReviewedRecordingStep[],
  add_terminal_success: boolean
}) -> WorkflowDetail
```

`create_new` persists a normal workflow row, generated graph, and the backend's
internal recorder settings snapshot with the reviewed workflow name. `replace_graph`
requires a draft linked to an existing workflow and replaces only that workflow's
graph; saved Workflow Settings and browser identity remain unchanged.
Before generating the saved graph, the backend reconciles `reviewed_steps`
against the backend-held draft by step id. It honors reviewed labels, inclusion
flags, and supported captured value edits such as navigated URL, input text,
select value, clipboard text, scroll pixels, and reviewed upload file paths; action type,
locator, source event, and warning replacement from renderer input is ignored.
Successful save consumes the backend-memory draft and source session. Discarding
a recorder session also removes generated drafts for that session.

## Evidence Shape

Evidence items are derived from persisted run outputs and run steps rather than
a separate projection table. Supported item kinds are `screenshot`, `download`,
`browser_identity`, `action_trace`, and `evidence_manifest`. File artifact items
carry only safe run-scoped relative paths such as `runs/<run_id>/screenshots/...`;
artifact preview/reveal/export commands accept evidence ids and revalidate path
containment in the Electron backend. Historical identity fields come from the
run-time settings snapshot and sanitized `browser_identity` output, not the
workflow's current identity after later rotation. Evidence-to-Identity
navigation opens a read-only historical identity target with workflow, run, and
evidence context so rotated identity observations remain inspectable.

## Identity Lab Shape

Identity Lab is a read model, not a new identity catalog table. Managed
identity rows are derived from current Workflow Settings Browser Launch values.
Run metrics match exact current `workflow_id` and `identity_id` from the run
settings snapshot, with a safe fallback to sanitized `browser_identity` output
only when the run association is unambiguous. Runs from previous identities are
historical and do not count toward the current identity's last run, recent
failure, valid run-scoped evidence item total, or latest observed report after
reset.

Historical identity references are read-only. They may carry safe workflow,
run, or evidence context. Stale managed identity targets that no longer match
current Workflow Settings resolve through the same historical lookup so old run
context remains inspectable. Historical lookup is not capped to the newest run
rows before matching identity ids, but the returned detail remains bounded and
sanitized. When a matched historical run exists, its persisted workflow id is
the source of truth for the displayed workflow context. Historical references
do not expose diagnostics, reset, close session, or settings mutation actions.

Identity diagnostics in the DTO are sanitized. They report installed/version
state, GeoIP/display availability, bounded profile size/session state, and
font posture where available, while excluding absolute local paths, proxy
credentials, cookies, localStorage, sessionStorage, profile contents, and raw
arbitrary run outputs.

## Graph Shape

Workflow graph data is the product authoring surface. New workflows create a v2 `Start -> New node` draft graph, where `New node` is an action node with `config: null`. Existing Start-only saved graphs remain valid drafts.

Graph validation issues serialize as `{ level, node_id, edge_id, message }`, where `level` is `error` or `warning`.

Graph links are directed execution edges. The frontend replaces any existing edge that shares the same source output or target input when a port is reconnected, except Merge `in` keeps multiple incoming branch links. Links may carry an optional duration-only `delay`; the compiler emits it as a synthetic fixed or random wait before the target node. Edge order labels are display-only and follow the same stable port traversal shape as graph compilation rather than raw edge array order. Backend validation is authoritative and rejects self-links, duplicate edges, invalid edge wait ranges, more than one outgoing edge from the same output port, more than one incoming edge to the same non-Merge input port, missing ports/nodes, unreachable non-start nodes, unsupported free cycles, and loop-control nodes reachable outside a loop body. Validation may return warnings for optional branches or continuations that are missing but still executable.

Current frontend graph authoring uses `@xyflow/react` for pan, zoom, drag, handles, minimap, controls, background, and selection. Manual auto arrange updates node positions into deterministic execution lanes that stay left-to-right for compact graphs and wrap long main paths into rows so large recordings do not become one unreachable line; it remains a normal graph edit. Persisted `WorkflowGraph` remains the source of truth and is converted through frontend React Flow adapters.

Current frontend graph authoring supports explicit port connection, edge deletion, multi-selection bulk edit commands, action config editing, and structured config editing for:

- `if` conditions.
- `switch` expressions and case ports.
- `router` first-match decision table cases with stable case ids.
- `random_choice` weighted choices with stable choice ids.
- `merge` explicit fan-in points.
- `repeat_times` loop counts.
- `repeat_for_each` item name with either a literal item list or a variable-array source.
- `while` and `repeat_until` conditions plus loop guard settings.
- `retry` max attempts and delay.
- `call_subflow` project-local subflow reference, input mapping, and optional
  output prefix metadata.
- `wait` duration/condition waits and `random_wait` min/max duration waits.
- `stop_workflow`, `set_variable`, `set_json_variables`, `transform_variable`, `assert_output`, `domain_allowlist`, `end_success`, and `end_failure`.

The main graph toolbar exposes beginner-facing authoring groups: New node, Add
Action, Add Subflow, Add Logic, Add Variable, and Add End. Workflow graphs use
Add Subflow to choose a same-project subflow and create a configured
`call_subflow` node labeled with the subflow name; subflow graphs hide Add
Subflow.

The Electron backend compiler currently emits action, `call_subflow`, `if`,
`switch`, `router`, `random_choice`, `merge`, `repeat_times`,
`repeat_for_each`, `while`, `repeat_until`, `retry`, `try_catch`, `fallback`,
loop break/continue, stop, variable, JSON variable, output assertion, domain
allowlist, success end, and failure end graph nodes. Graph-native control
blocks compile branch ports into nested action configs and then continue
through explicit continuation ports. Call Subflow resolves same-project
subflows, compiles mapped inputs as variables, and inlines subflow graph steps
with prefixed ids/labels into the caller plan. Nested compiled action configs
retain their source graph node id/label so runner traces and persisted
`run_steps` rows can identify the exact executed branch/body action.
The compiler can also compile a sub-plan from one selected main-path node when
Run from selected is enabled. `run_policy.run_from_selected_mode` chooses
whether that sub-plan contains only the selected node (`selected_only`) or the
selected node through the downstream main path (`from_selected`). Selected-node
plans use the same subflow resolver as full workflow plans. Nodes inside
branch/loop/retry/try/fallback bodies are rejected for run-from-selected until
nested execution semantics are designed.

Settings prelude compilation is represented in TypeScript. It can prepend Environment initial variables. Browser Launch identity settings are applied by the runner/session manager rather than compiled into graph prelude actions.

Executable frontend/backend ports must agree:

- `start`: output `out`
- `end_success` / `end_failure`: input `in`
- `action`: input `in`, output `out`; `config: null` is a saveable draft marker but blocks validation/compile/run.
- `call_subflow`: input `in`, output `out`; config stores
  `{ subflow_id, input_mapping, output_prefix }`.
- `merge`: input `in`, output `out`; input `in` may receive multiple incoming edges and compiles to an internal no-op step.
- `router`: input `in`, outputs `case_<id>` for each configured stable-id case, `default`, and `done`.
- `random_choice`: input `in`, outputs `choice_<id>` for each configured stable-id weighted choice, and `done`.
- `if`: input `in`, outputs `true`, `false`, `done`
- `switch`: input `in`, outputs `case_N`, `default`, `done`
- `repeat_times` / `repeat_for_each` / `while`: input `in`, outputs `loop`, `done`
- `repeat_until`: input `in`, outputs `loop`, `done`, `timeout`
- `retry`: input `in`, outputs `try`, `success`, `failed`
- `try_catch`: input `in`, outputs `try`, `success`, `error`, `finally`, `done`
- `fallback`: input `in`, outputs `primary`, `fallback`, `done`
- `break_loop` / `continue_loop` / `stop_workflow`: input `in`
- `set_variable` / `set_json_variables` / `transform_variable` / `assert_output` / `domain_allowlist`: input `in`, output `out`

## Action Config Shape

Action configs use a tagged TypeScript DTO shape:

```text
{ type: "click", config: { ... } }
```

The `type` string must match the TypeScript `ActionType` union. Unknown action
types, unknown nested action types, unknown graph `node_type` values, and
unknown `condition.kind` values are rejected by backend validation before they
can be saved, imported, compiled, or executed through normal commands.
`scroll` accepts `mode: "page" | "into_view" | "until_element_visible"`. Missing
mode is treated as legacy `"page"` and uses `direction` plus `pixels`.
Page mode accepts optional `scroll_style: "human_like" | "smooth_single"`;
missing style keeps the existing human-like chunked wheel gestures, and
`smooth_single` sends one wheel gesture for the requested distance.
Element-targeted scroll uses `target` or legacy `xpath`, optional
`iframe_xpath`, and optional `timeout_ms`. When `timeout_ms` is omitted, target
scroll defaults to `60000` ms. `until_element_visible` uses the same target
fields plus `direction` and `pixels` for repeated page-scroll search gestures
before the target-scroll phase.
`find_element` stores a run-local element ref by `output_name`; targetable
single-target actions may use that name in `target_ref` instead of a direct
target. Element refs are not portable across runs and their serialized outputs
are evidence metadata. Scroll Until Element Visible still uses locator target
fields because it may need to create or reveal an element that is not yet
resolved.

Graph-internal Merge and Router configs use:

```text
{ type: "graph_noop", config: { kind: "merge" } }
{
  type: "router_condition",
  config: {
    mode: "first_match",
    cases: [{ id, label, condition, steps }],
    default_steps
  }
}
```

Random Choice graph nodes compile to:

```text
{
  type: "random_choice",
  config: {
    output_name,
    choices: [{ id, label, weight, steps }]
  }
}
```

`set_variable` remains backward compatible with saved single-value configs:

```text
{ type: "set_variable", config: { name: "token", value: "abc" } }
```

New variable authoring stores multiple rows:

```text
{
  type: "set_variable",
  config: {
    variables: [
      { name: "user.name", value_type: "text", value: "Ada" },
      { name: "roles", value_type: "json", value: "[\"admin\"]" }
    ]
  }
}
```

`set_json_variables` stores a JSON object string:

```text
{ type: "set_json_variables", config: { json: "{\"roles\":[\"admin\"]}" } }
```

`repeat_for_each` supports manual `items` or `array_variable`. Variable-array mode requires a non-empty `array_variable` and uses the current runtime array value in order.

Terminal End Success, End Failure, and Stop Workflow graph nodes can carry `close_browser: true` in their node config. The compiler maps that to executable `stop_workflow` configs so the runner closes the browser after outputs are captured. Missing or false keeps the browser session retained.

Graph settings can apply duration-only waits to newly created links. Authors still use explicit `wait` and `random_wait` graph nodes when a pause has business meaning or waits for page/browser state.

## Change Checklist

- Update TypeScript DTOs, graph compiler, runner, and UI defaults together.
- Update default configs for new action variants.
- Update persistence tests if stored JSON shape changes.
- Update command tests if command response shape changes.
- Update docs in `contracts/` and affected domain docs.
