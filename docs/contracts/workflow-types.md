# Workflow Type Contracts

## Source Files

- TypeScript: `src/types/workflow.ts`
- Electron bridge: `src/types/electron.ts`
- Node command handlers: `electron/backend/commands.ts`
- TypeScript graph compiler: `electron/backend/graphCompiler.ts`
- CloakBrowser runner: `electron/backend/runner.ts`
- SQLite repository: `electron/backend/workflowRepository.ts`

## Workflow Shapes

Frontend and backend must agree on:

- `WorkflowSummary`: `id`, `name`, `step_count`, `created_at`, `updated_at`.
- `Workflow`: `id`, `name`, `created_at`, `updated_at`.
- `WorkflowDetail`: workflow metadata, while the product UI loads graph authoring data through `get_workflow_graph`.
- `WorkflowSettings`: per-workflow aggregate loaded through `get_workflow_settings`, with `general`, `run_policy`, `browser_launch`, `graph_defaults`, and `environment` sections.
- `WorkflowGraph`: `version`, `nodes`, `edges`, `viewport`.
- `GraphNode`: `id`, `node_type`, `label`, `position`, `config`, `ports`, optional `group_id`.
- `GraphEdge`: `id`, `source_node_id`, `source_port`, `target_node_id`, `target_port`, optional `label`, optional `condition`, optional `delay`.
- `CompiledWorkflowGraph`: `steps`, where each compiled step carries `node_id`, `label`, and `config`, plus optional `domain_policy` with allowed domains resolved from graph allowlist nodes.
- `RunState.retained_session`: optional retained browser session availability metadata used by debug run-from-selected UI.
- `WorkflowRunSnapshot`: run-id scoped status wrapper with `run_id`, `workflow_id`, `workflow_name`, `source` (`manual` or `schedule`), `started_at`, and nested `state: RunState`, plus mirrored top-level run-state fields for compatibility.
- `WorkflowPackage`: product-facing import/export JSON with `kind: "workflow_package"`, `version: 2`, workflow name metadata, `included_sections`, `omitted_fields`, optional `flow`, and optional partial `settings`.
- `WorkflowSchedule`: persisted schedule DTO with workflow id/name, schedule name, enabled state, kind, next run time, last event summary, and timestamps.
- `WorkflowScheduleEvent`: persisted scheduler audit event for started, skipped, missed, failed-to-start, and disabled decisions.

## Workflow Settings Shape

Workflow Settings are persisted separately from graph JSON:

```text
{
  workflow_id: string,
  version: 2,
  general: { name, description, tags, notes, created_at, updated_at },
  run_policy: {
    max_workflow_duration_ms,
    browser_retention,
    batch_concurrency_limit,
    batch_headless,
    batch_stop_on_first_failed_row
  },
  browser_launch: {
    session_mode,
    identity_id,
    display_name,
    profile_dir,
    fingerprint_seed,
    fingerprint_overrides_enabled,
    profile_name,
    user_agent,
    viewport_width,
    viewport_height,
    device_scale_factor,
    mobile,
    touch,
    timezone,
    locale,
    geoip,
    proxy_label,
    proxy_region,
    proxy_provider,
    proxy_bypass,
    test_account_binding,
    webrtc_policy,
    webrtc_ip,
    fingerprint_platform,
    hardware_concurrency,
    device_memory_gb,
    fingerprint_fonts_dir,
    storage_quota_mb,
    preflight_enabled,
    preflight_probe_url,
    preflight_allowed_origins,
    proxy_enabled,
    proxy_server,
    proxy_username,
    proxy_password,
    headless,
    humanize,
    human_preset,
    run_from_selected_enabled
  },
  graph_defaults: {
    default_edge_delay: null
      | { type: "fixed", duration_ms }
      | { type: "random", min_ms, max_ms }
  },
  environment: { initial_variables },
  migration_notes: [{ path, action, message }]
}
```

`identity_id` and `profile_dir` are stable storage identifiers; `display_name` is operator-editable metadata. `fingerprint_seed` is generated when an identity is created and reused until the operator resets or duplicates the identity. `profile_name` mirrors `profile_dir` for persistent-profile runs.

Proxy credentials can be provided as URL credentials or separate
username/password fields, but not both. Package export removes proxy passwords
and proxy URL credentials. `fingerprint_overrides_enabled` defaults to false,
so CloakBrowser seed-generated user-agent, viewport/device, hardware, storage,
and font signals are used unless the operator enables Custom fingerprint
overrides. Advanced fingerprint controls are allowlisted fields only; raw
Chromium argument text is not part of the public settings contract.
CloakBrowser humanization defaults to `true` and is persisted as the Browser Launch `humanize` toggle. `human_preset` maps to CloakBrowser `humanPreset` and accepts `default` or `careful`, with invalid or missing persisted values normalized to `default`.

Settings validation issues serialize as `{ section, field, message, level }`.
Run validation issues serialize as `{ source, field, node_id, edge_id, message, level }`.
Workflow exports include optional `settings`; imports without settings are valid flow-only packages.
Run Policy batch fields remain part of the current contract for backend batch execution, but Workflow Settings currently renders those batch controls as visible, disabled values until Batch Run UI is ready.
Graph default link wait is an authoring default only. It is copied onto newly created graph links and does not rewrite existing links.

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
  settings: {
    general,
    run_policy,
    browser_launch,
    graph_defaults,
    environment
  } // every section optional
}
```

Package export options serialize as `{ include_flow, settings_sections }`, where `settings_sections` contains Workflow Settings section ids. Package import uses the same option shape, always creates a new workflow, and remaps selected settings to the new workflow id.

Package preview serializes as `{ workflow_name, includes_flow, settings_sections, omitted_fields }`. Preview is the UI review point before import. Package import validates selected flow/settings before creation and saves workflow, graph, and settings in one SQLite transaction so failed imports do not leave orphan workflows.

Export sanitizes machine-local or sensitive fields by default: `settings.browser_launch.proxy_password`, credentials embedded in `settings.browser_launch.proxy_server`, and secret search/hash portions of `settings.browser_launch.preflight_probe_url`.

`BrowserProfileDiagnostics` reports profile directory, identity/workflow
metadata, approximate size, last modified time, last run time, and active-session
status. `BrowserProfileCleanupResult` reports deleted orphan profile directories,
skipped referenced or active profiles, and reclaimed bytes.
`CloakBrowserDiagnostics` also reports font-check status, last smoke result
status, and the latest persisted `fingerprint_preflight` verdict summary when a
run has produced one.

`WorkflowDeleteOptions` serializes as `{ deleteBrowserProfile?: boolean }`.
Deletion keeps profile data by default. When `deleteBrowserProfile` is true, the
backend removes only the deleting workflow's private profile directory; shared
or active-session profile directories are retained.

Local workflow duplication is not a workflow package export. The `duplicate_workflow` command copies the saved graph and non-storage Workflow Settings to a new workflow id, including local fields that package export sanitizes for external sharing. Browser Launch gets a fresh `identity_id`, `profile_dir`, `profile_name` when persistent sessions are enabled, and `fingerprint_seed`; `run_from_selected_enabled` is reset to false so the copy cannot reuse the source retained session.

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

## Graph Shape

Workflow graph data is the product authoring surface. New workflows create a v2 `Start -> New node` draft graph, where `New node` is an action node with `config: null`. Existing Start-only saved graphs remain valid drafts.

Graph validation issues serialize as `{ level, node_id, edge_id, message }`, where `level` is `error` or `warning`.

Graph links are directed execution edges. The frontend replaces any existing edge that shares the same source output or target input when a port is reconnected, except Merge `in` keeps multiple incoming branch links. Links may carry an optional duration-only `delay`; the compiler emits it as a synthetic fixed or random wait before the target node. Edge order labels are display-only and follow the same stable port traversal shape as graph compilation rather than raw edge array order. Backend validation is authoritative and rejects self-links, duplicate edges, invalid edge wait ranges, more than one outgoing edge from the same output port, more than one incoming edge to the same non-Merge input port, missing ports/nodes, unreachable non-start nodes, unsupported free cycles, and loop-control nodes reachable outside a loop body. Validation may return warnings for optional branches or continuations that are missing but still executable.

Current frontend graph authoring uses `@xyflow/react` for pan, zoom, drag, handles, minimap, controls, background, and selection. Manual auto arrange updates node positions into deterministic left-to-right execution columns and remains a normal graph edit. Persisted `WorkflowGraph` remains the source of truth and is converted through frontend React Flow adapters.

Current frontend graph authoring supports explicit port connection, edge deletion, multi-selection bulk edit commands, action config editing, and structured config editing for:

- `if` conditions.
- `switch` expressions and case ports.
- `router` first-match decision table cases with stable case ids.
- `merge` explicit fan-in points.
- `repeat_times` loop counts.
- `repeat_for_each` item name with either a literal item list or a variable-array source.
- `while` and `repeat_until` conditions plus loop guard settings.
- `retry` max attempts and delay.
- `wait` duration/condition waits and `random_wait` min/max duration waits.
- `stop_workflow`, `set_variable`, `set_json_variables`, `transform_variable`, `assert_output`, `domain_allowlist`, `end_success`, and `end_failure`.

The main graph toolbar exposes beginner-facing authoring groups: New node, Add Action, Add Logic, Add Variable, and Add End.

The Electron backend compiler currently emits action, `if`, `switch`, `router`, `merge`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`, `retry`, `try_catch`, `fallback`, loop break/continue, stop, variable, JSON variable, output assertion, domain allowlist, success end, and failure end graph nodes. Graph-native control blocks compile branch ports into nested action configs and then continue through explicit continuation ports.
The compiler can also compile a sub-plan from one selected main-path node when Run from selected is enabled. Nodes inside branch/loop/retry/try/fallback bodies are rejected for run-from-selected until nested execution semantics are designed.

Settings prelude compilation is represented in TypeScript. It can prepend Environment initial variables. Current owned fingerprint preflight is a Browser Launch identity setting, not a graph prelude action.

Executable frontend/backend ports must agree:

- `start`: output `out`
- `end_success` / `end_failure`: input `in`
- `action`: input `in`, output `out`; `config: null` is a saveable draft marker but blocks validation/compile/run.
- `merge`: input `in`, output `out`; input `in` may receive multiple incoming edges and compiles to an internal no-op step.
- `router`: input `in`, outputs `case_<id>` for each configured stable-id case, `default`, and `done`.
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

The `type` string must match the TypeScript `ActionType` union.
`scroll` accepts `mode: "page" | "into_view" | "until_visible"`. Missing
mode is treated as legacy `"page"` and uses `direction` plus `pixels`.
Element-targeted scroll modes use `target` or legacy `xpath`, optional
`iframe_xpath`, and optional `timeout_ms`.

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
