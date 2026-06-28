# Workflow Type Contracts

## Source Files

- TypeScript public barrel: `src/types/workflow.ts`
- Core/settings/action DTOs: `src/types/workflowCore.ts`
- Graph/schedule/operations DTOs: `src/types/workflowGraphOps.ts`
- Evidence/identity/package/recording/run DTOs: `src/types/workflowEvidenceRecording.ts`
- Shared persona catalog: `src/lib/personaCatalog.ts`
- Electron bridge: `src/types/electron.ts`

For exact shapes, read the TypeScript source. This doc covers cross-boundary rules and serialization gotchas only.

## Cross-Boundary Rules

- Frontend and backend must agree on DTO shapes. Source of truth: `src/types/workflow.ts`.
- Unknown action types, nested action types, graph `node_type` values, and `condition.kind` values are rejected by backend validation before save/import/compile/run.
- Settings validation: `{ section, field, message, level }`.
- Run validation: `{ source, field, node_id, edge_id, message, level }`.
- Graph validation: `{ level, node_id, edge_id, message }`.
- Schedule validation: `{ field, message, level }`.
- `CommandError` serializes as `{ message, field? }`.

## Workflow Settings Gotchas

- `browser_launch` fields are profile-owned, not workflow-owned.
- `identity_id`: `bi_<32 hex>`, collision-probed. `fingerprint_seed`: generated per profile.
- `timezone`/`locale`: blank = GeoIP resolves from proxy exit IP. Explicit = GeoIP off.
- Proxy credentials: URL credentials OR separate fields, not both.
- `fingerprint_fonts_dir`: nullable. Lazy default = `.local/cloakbrowser-fonts/linux`. Explicit `null` stays cleared.
- `human_preset`: `default` or `careful`, normalized through persona timing profile.
- `execute_js_enabled`: defaults true. When false, runner rejects Run JavaScript.
- `live_run_enabled` defaults true, `live_run_follow_current` defaults false.
- Package export sanitizes: proxy password, URL credentials, font dirs.
- **Browser Profile Environment Variables**: Environment variables can be defined inside Browser Profiles (`environment_json` in `browser_profiles` table).
- **Precedence**: Environment variables are seeded during graph compilation in the following order: Browser Profile Environment Variables (lowest priority) -> Workflow Settings Environment Variables (medium priority) -> Workflow logic nodes (e.g. `set_variable` node at runtime, highest priority).
- **Persistence**: Profile environment variables support a `persist: boolean` flag. If enabled, the final value of the variable at the end of a run is persisted back to the Browser Profile in the database.

## Package Contracts

### Workflow Package v2
```text
{ kind: "workflow_package", version: 2, workflow: { name },
  included_sections, omitted_fields, flow?, subflows?, settings? }
```
- Import always creates new workflow. Call Subflow ids remapped. Browser Launch import creates private profile.

### Project Package v1
```text
{ kind: "project_package", version: 1, project: { name, description },
  included_sections, omitted_fields, browser_profiles[], subflows[], workflows[] }
```
- Import creates `<name> (imported)` project with fresh identities. No runs/evidence/schedules.

## Port Contract

Executable frontend/backend ports must agree:

| Node Type | Input | Outputs |
|-----------|-------|---------|
| `start` | — | `out` |
| `action` | `in` | `out` (`config: null` = draft, blocks compile) |
| `call_subflow` | `in` | `out` |
| `merge` | `in` (multi) | `out` |
| `router` | `in` | `case_<id>`, `default`, `done` |
| `random_choice` | `in` | `choice_<id>`, `done` |
| `if` | `in` | `true`, `false`, `done` |
| `switch` | `in` | `case_N`, `default`, `done` |
| loops | `in` | `loop`, `done` (+`timeout` for `repeat_until`) |
| `retry` | `in` | `try`, `success`, `failed` |
| `try_catch` | `in` | `try`, `success`, `error`, `finally`, `done` |
| `fallback` | `in` | `primary`, `fallback`, `done` |
| terminals | `in` | — |
| variables | `in` | `out` |
| `end_success`/`end_failure` | `in` | — |

## Serialization Notes

- `set_variable`: backward compat with `{ name, value }` single form; new: `{ variables: [{ name, value_type, value }] }`.
- Terminal nodes: `close_browser: true` maps to `stop_workflow` config at compile.
- `scroll`: legacy missing mode = `page`. `timeout_ms` default = `60000`.
- `find_element` refs: not portable across runs. Used by `target_ref`, `source_ref`, `trigger_ref`.
- Graph-internal: `{ type: "graph_noop", config: { kind: "merge" } }` and `{ type: "router_condition", ... }`.

## Quarantined Nodes

A node that fails to load (unknown `node_type`, corrupted `config`, or Zod
validation failure) is converted to a `quarantined` placeholder instead of
crashing the load path. The original payload is preserved verbatim.

```ts
{
  id: <original id>,
  node_type: "quarantined",
  label: <original label> ?? "Quarantined node",
  position: <original position> ?? { x: 0, y: 0 },
  ports: [],
  config: {
    type: "quarantined",
    config: {
      original_type: string | null,
      reason: "unknown_type" | "invalid_config" | "parse_error",
      message: string,
      original_payload: unknown,
    }
  }
}
```

- The compiler treats `quarantined` as a no-op step that emits a warning.
- `validateGraph.ts` reports each quarantined node as a `warning`-level issue
  so the workflow stays runnable but the UI surfaces the problem.
- `ActionConfig` includes a `{ type: "quarantined"; config: { ... } }` variant;
  `GraphNodeType` includes `"quarantined"`.

## Deprecation Field

`ActionDefinition` in `electron/backend/actions/registry.ts` carries an
optional `deprecated` field (`{ since, replacement?, reason }`) plus
`configSchema: z.ZodSchema`. Deprecated actions still execute normally but
`validateGraph.ts` emits one `warning` per deprecated node. The migration
framework is the only removal path.

## Change Checklist

- Update TypeScript DTOs, graph compiler, runner, and UI defaults together.
- Update default configs for new action variants.
- Update persistence tests if stored JSON shape changes.
- Update command tests if command response shape changes.
