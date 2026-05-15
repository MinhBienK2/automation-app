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
- `WorkflowStep`: legacy/internal step row shape used by import/export compatibility and compiled graph runner adapters.
- `WorkflowDetail`: currently `workflow`, `steps` for compatibility, while the product UI loads graph authoring data through `get_workflow_graph`.
- `WorkflowSettings`: per-workflow aggregate loaded through `get_workflow_settings`, with `general`, `run_policy`, `browser_launch`, and `environment` sections.
- `WorkflowBrowserConfig`: legacy compatibility shape loaded through `get_workflow_browser_config`; command handlers map it to `WorkflowSettings.browser_launch`.
- `WorkflowGraph`: `version`, `nodes`, `edges`, `viewport`.
- `GraphNode`: `id`, `node_type`, `label`, `position`, `config`, `ports`, optional `group_id`.
- `GraphEdge`: `id`, `source_node_id`, `source_port`, `target_node_id`, `target_port`, optional `label`, optional `condition`.
- `CompiledWorkflowGraph`: `steps`, where each compiled step carries `node_id`, `label`, and `config`, plus optional `domain_policy` with allowed domains resolved from graph allowlist nodes.
- `RunState.retained_session`: optional retained browser session availability metadata used by debug run-from-selected UI.
- `WorkflowPackage`: product-facing import/export JSON with `kind: "workflow_package"`, `version: 2`, workflow name metadata, `included_sections`, `omitted_fields`, optional `flow`, and optional partial `settings`.

## Browser Config Shape

Workflow browser config remains as a legacy compatibility command shape:

```text
{
  workflow_id: string,
  profile_name: string | null,
  proxy_enabled: boolean,
  proxy_server: string | null,
  proxy_username: string | null,
  proxy_password: string | null,
  headless: boolean
}
```

Blank optional text fields normalize to `null`. A proxy server is required when `proxy_enabled` is true. This compatibility shape maps into `settings.browser_launch`.

## Workflow Settings Shape

Workflow Settings are persisted separately from graph JSON and legacy ordered steps:

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
    humanize,
    human_preset,
    behavior_fidelity,
    preflight_enabled,
    preflight_probe_url,
    preflight_allowed_origins,
    proxy_enabled,
    proxy_server,
    proxy_username,
    proxy_password,
    headless,
    run_from_selected_enabled
  },
  environment: { initial_variables },
  migration_notes: [{ path, action, message }]
}
```

`identity_id` and `profile_dir` are stable storage identifiers; `display_name` is operator-editable metadata. `fingerprint_seed` is generated when an identity is created and reused until the operator resets or duplicates the identity. `profile_name` remains as a legacy compatibility key and mirrors `profile_dir` for persistent-profile runs.

Proxy credentials can be provided as URL credentials or separate
username/password fields, but not both. Package export removes proxy passwords
and proxy URL credentials. Advanced fingerprint controls are allowlisted fields
only; raw Chromium argument text is not part of the public settings contract.
`behavior_fidelity` is `balanced`, `strict_humanized`, or
`deterministic_internal`.

Settings validation issues serialize as `{ section, field, message, level }`.
Run validation issues serialize as `{ source, field, node_id, edge_id, message, level }`.
Workflow exports include optional `settings`; imports without settings remain valid legacy exports.
Run Policy batch fields remain part of the current contract for backend batch compatibility, but Workflow Settings currently renders those batch controls as visible, disabled values until Batch Run UI is ready.

Legacy v1 settings are migrated on load into v2. Obsolete browser emulation, timing, retry, challenge, context-seeding, storage, and trigger fields are dropped with migration notes instead of being preserved in the public contract. Removed legacy fingerprint gate data is ignored unless it maps cleanly to the current Browser Launch preflight fields.

Legacy v1 workflow graphs are migrated on load/save/import into graph contract v2. Action configs convert legacy XPath selector fields into structured targets (`xpath` -> `target`, `source_xpath` -> `source_target`, `target_xpath` -> `target_target`, `trigger_xpath` -> `trigger_target`) and fold `iframe_xpath` into nested target iframe selectors. Obsolete per-action engine knobs such as action timeouts, wait readiness, typing delays, click retry/post-click settings, click positioning, and clear-field method settings are dropped with `migration_notes` on the graph.

## Workflow Package Shape

Workflow Package v2 is the current user-facing import/export format. It is graph-first and does not use legacy ordered step rows:

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
    environment
  } // every section optional
}
```

Package export options serialize as `{ include_flow, settings_sections }`, where `settings_sections` contains Workflow Settings section ids. Package import uses the same option shape, always creates a new workflow, and remaps selected settings to the new workflow id.
Legacy package sections named `settings.owned_test_gates` are ignored by current preview/import flows and are not offered as selectable current settings.

Package preview serializes as `{ workflow_name, includes_flow, settings_sections, omitted_fields }`. Preview is the UI checkpoint before import. Package import validates selected flow/settings before creation and saves workflow, graph, and settings in one SQLite transaction so failed imports do not leave orphan workflows.

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

Local workflow duplication is not a workflow package export. The `duplicate_workflow` command copies the saved graph and full Workflow Settings to a new workflow id, including fields that package export sanitizes for external sharing.

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

## Graph Shape

Workflow graph data is the product authoring surface and is versioned separately from legacy ordered workflow step rows. New workflows create a v2 `Start -> New node` draft graph, where `New node` is an action node with `config: null`. Existing Start-only saved graphs remain valid drafts, and existing linear step rows can still be represented as a generated v2 graph with action nodes and a success end node for compatibility paths.

Graph validation issues serialize as `{ level, node_id, edge_id, message }`, where `level` is `error` or `warning`.

Graph links are directed execution edges. The frontend replaces any existing edge that shares the same source output or target input when a port is reconnected. Backend validation is authoritative and rejects self-links, duplicate edges, more than one outgoing edge from the same output port, more than one incoming edge to the same input port, missing ports/nodes, unreachable non-start nodes, unsupported free cycles, and loop-control nodes reachable outside a loop body. Validation may return warnings for optional branches or continuations that are missing but still executable.

Current frontend graph authoring uses `@xyflow/react` for pan, zoom, drag, handles, minimap, controls, background, and selection. Persisted `WorkflowGraph` remains the source of truth and is converted through frontend React Flow adapters.

Current frontend graph authoring supports explicit port connection, edge deletion, multi-selection bulk edit commands, action config editing, and structured config editing for:

- `if` conditions.
- `switch` expressions and case ports.
- `repeat_times` loop counts.
- `repeat_for_each` item name with either a literal item list or a variable-array source.
- `while` and `repeat_until` conditions plus loop guard settings.
- `retry` max attempts and delay.
- `manual_approval` reason and optional timeout.
- `rate_limit` delay.
- `wait` duration/condition waits and `random_wait` min/max duration waits.
- `stop_workflow`, `set_variable`, `set_json_variables`, `transform_variable`, `assert_output`, `run_subworkflow`, `domain_allowlist`, `end_success`, and `end_failure`.

The main graph toolbar only exposes beginner-facing authoring groups: New node, Add Action, Add Logic, Add Variable, and Add End. Some graph node types in the contract remain loadable/editable for compatibility but are hidden from the main add palettes.

The Electron backend compiler currently emits action, manual approval, rate limit, `if`, `switch`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`, `retry`, `try_catch`, `fallback`, loop break/continue, stop, variable, JSON variable, output assertion, subworkflow, domain allowlist, success end, and failure end graph nodes. `run_subworkflow` is represented in the compiled action plan for compatibility but fails explicitly at runtime until nested lifecycle semantics are implemented. Graph-native control blocks compile branch ports into nested action configs and then continue through explicit continuation ports.
The compiler can also compile a sub-plan from one selected main-path node when Run from selected is enabled. Nodes inside branch/loop/retry/try/fallback bodies are rejected for run-from-selected until nested execution semantics are designed.

Settings prelude compilation is represented in TypeScript. It can prepend Environment initial variables. Browser context seeding, default action timeouts, interaction fidelity defaults, and global waits between nodes are legacy settings and are removed from the v2 public contract. Current owned fingerprint preflight is a Browser Launch identity setting, not a graph prelude action.

Executable frontend/backend ports must agree:

- `start`: output `out`
- `end_success` / `end_failure`: input `in`
- `action`: input `in`, output `out`; `config: null` is a saveable draft marker but blocks validation/compile/run.
- `if`: input `in`, outputs `true`, `false`, `done`
- `switch`: input `in`, outputs `case_N`, `default`, `done`
- `repeat_times` / `repeat_for_each` / `while`: input `in`, outputs `loop`, `done`
- `repeat_until`: input `in`, outputs `loop`, `done`, `timeout`
- `retry`: input `in`, outputs `try`, `success`, `failed`
- `try_catch`: input `in`, outputs `try`, `success`, `error`, `finally`, `done`
- `fallback`: input `in`, outputs `primary`, `fallback`, `done`
- `break_loop` / `continue_loop` / `stop_workflow`: input `in`
- `manual_approval` / `rate_limit`: input `in`, output `out`
- `set_variable` / `set_json_variables` / `transform_variable` / `assert_output` / `run_subworkflow` / `domain_allowlist`: input `in`, output `out`

## Action Config Shape

Action configs use a tagged TypeScript DTO shape:

```text
{ type: "click", config: { ... } }
```

The `type` string must match the TypeScript `ActionType` union.

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

Workflow-level wait-between-nodes settings are not part of the v2 public settings contract. Authors use explicit `wait` and `random_wait` graph nodes when a workflow needs a business-semantic pause.

## Change Checklist

- Update TypeScript DTOs, graph compiler, runner, and UI defaults together.
- Update default configs for new action variants.
- Update persistence tests if stored JSON shape changes.
- Update command tests if command response shape changes.
- Update docs in `contracts/` and affected domain docs.
