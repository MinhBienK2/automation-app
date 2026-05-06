# Workflow Type Contracts

## Source Files

- TypeScript: `src/types/workflow.ts`
- Rust workflow domain: `src-tauri/src/domain/workflow.rs`
- Rust action configs: `src-tauri/src/domain/action_config.rs`
- Rust graph domain: `src-tauri/src/domain/workflow_graph.rs`
- Rust settings domain: `src-tauri/src/domain/workflow_settings.rs`
- Rust browser config domain: `src-tauri/src/domain/browser_config.rs`
- Rust run types: `src-tauri/src/domain/run.rs`
- Repository DTOs: `src-tauri/src/repositories/workflow_repository.rs`

## Workflow Shapes

Frontend and backend must agree on:

- `WorkflowSummary`: `id`, `name`, `step_count`, `created_at`, `updated_at`.
- `Workflow`: `id`, `name`, `created_at`, `updated_at`.
- `WorkflowStep`: legacy/internal step row shape used by import/export compatibility and compiled graph runner adapters.
- `WorkflowDetail`: currently `workflow`, `steps` for compatibility, while the product UI loads graph authoring data through `get_workflow_graph`.
- `WorkflowSettings`: per-workflow aggregate loaded through `get_workflow_settings`, with `general`, `execution`, `browser`, `environment`, `inputs`, `triggers`, and `advanced` sections.
- `WorkflowBrowserConfig`: legacy compatibility shape loaded through `get_workflow_browser_config`; command handlers map it to `WorkflowSettings.browser`.
- `WorkflowGraph`: `version`, `nodes`, `edges`, `viewport`.
- `GraphNode`: `id`, `node_type`, `label`, `position`, `config`, `ports`, optional `group_id`.
- `GraphEdge`: `id`, `source_node_id`, `source_port`, `target_node_id`, `target_port`, optional `label`, optional `condition`.
- `CompiledWorkflowGraph`: `steps`, where each compiled step carries `node_id`, `label`, and `config`.
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
  user_agent: string | null,
  viewport_width: number | null,
  viewport_height: number | null,
  mobile: boolean,
  touch: boolean,
  challenge_policy: "none" | "detect_only" | "pause_for_human"
}
```

Blank optional text fields normalize to `null`. A proxy server is required when `proxy_enabled` is true, and viewport dimensions must be greater than zero when present.

## Workflow Settings Shape

Workflow Settings are persisted separately from graph JSON and legacy ordered steps:

```text
{
  workflow_id: string,
  version: number,
  general: { name, description, tags, notes, created_at, updated_at },
  execution: {
    default_action_timeout_ms,
    default_retry_attempts,
    default_retry_interval_ms,
    max_workflow_duration_ms,
    browser_retention,
    failure_policy,
    batch_concurrency_limit,
    batch_headless,
    batch_stop_on_first_failed_row,
    output_retention_days
  },
  browser: WorkflowBrowserConfig without workflow_id plus headless,
  environment: {
    geolocation,
    permissions,
    extra_http_headers,
    locale,
    timezone,
    download_directory,
    cookies,
    local_storage,
    session_storage,
    session_restore_ref
  },
  inputs: { input_schema, initial_variables, batch_mapping },
  triggers: {
    enabled,
    mode,
    interval_seconds,
    once_at,
    input_source,
    batch_source_ref,
    missed_run_policy,
    concurrency_policy,
    last_run_at,
    next_run_at
  },
  advanced: { compatibility_warnings, debug_logging_level, experimental_flags }
}
```

Settings validation issues serialize as `{ section, field, message, level }`.
Run validation issues serialize as `{ source, field, node_id, edge_id, message, level }`.
Workflow exports include optional `settings`; imports without settings remain valid legacy exports.

The UI labels the persisted `inputs` section as Variables and currently edits only `initial_variables`. `input_schema` and `batch_mapping` remain in the contract for saved-data compatibility.

## Workflow Package Shape

Workflow Package v2 is the current user-facing import/export format. It is graph-first and does not use legacy ordered step rows:

```text
{
  kind: "workflow_package",
  version: 2,
  workflow: { name },
  included_sections: ["flow", "settings.general"],
  omitted_fields: ["settings.browser.proxy_password"],
  flow: WorkflowGraph | null,
  settings: {
    general,
    execution,
    browser,
    environment,
    inputs,
    triggers,
    advanced
  } // every section optional
}
```

Package export options serialize as `{ include_flow, settings_sections }`, where `settings_sections` contains Workflow Settings section ids. Package import uses the same option shape, always creates a new workflow, and remaps selected settings to the new workflow id.

Package preview serializes as `{ workflow_name, includes_flow, settings_sections, omitted_fields }`. Preview is the UI checkpoint before import.

Export sanitizes machine-local or sensitive fields by default: `settings.browser.proxy_password`, `settings.environment.download_directory`, `settings.environment.cookies`, `settings.environment.local_storage`, `settings.environment.session_storage`, and `settings.environment.session_restore_ref`.

## Graph Shape

Workflow graph data is the product authoring surface and is versioned separately from legacy ordered workflow step rows. New workflows create a `Start -> New node` draft graph, where `New node` is an action node with `config: null`. Existing Start-only saved graphs remain valid drafts, and existing linear step rows can still be represented as a generated graph with action nodes and a success end node for compatibility paths.

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
- `stop_workflow`, `set_variable`, `set_json_variables`, `transform_variable`, `assert_output`, `run_subworkflow`, `domain_allowlist`, `end_success`, and `end_failure`.

The main graph toolbar only exposes beginner-facing authoring groups: New node, Add Action, Add Logic, Add Variable, and Add End. Some graph node types in the contract remain loadable/editable for compatibility but are hidden from the main add palettes.

The backend compiler currently executes action, manual approval, rate limit, `if`, `switch`, `repeat_times`, `repeat_for_each`, `while`, `repeat_until`, `retry`, `try_catch`, `fallback`, loop break/continue, stop, variable, JSON variable, output assertion, subworkflow, domain allowlist, success end, and failure end graph nodes. `run_subworkflow` is expanded at the command layer before the browser runner starts. Graph-native control blocks compile branch ports into nested action configs and then continue through explicit continuation ports.

Executable frontend/Rust ports must agree:

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

Action configs use a tagged shape compatible with Rust serde:

```text
{ type: "click", config: { ... } }
```

The `type` string must match Rust `ActionType` snake_case serialization.

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

## Change Checklist

- Update TypeScript and Rust together.
- Update default configs for new action variants.
- Update persistence tests if stored JSON shape changes.
- Update command tests if command response shape changes.
- Update docs in `contracts/` and affected domain docs.
