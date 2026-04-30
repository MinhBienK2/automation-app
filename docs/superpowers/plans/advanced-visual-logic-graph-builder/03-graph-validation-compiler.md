# Plan 3: Graph Validation And Compiler

## Objective

Implement deterministic graph validation and compilation for supported executable nodes. Validation must clearly block unsupported advanced runtime semantics instead of silently producing incorrect runs.

## TDD Slices

1. Add failing Rust tests for graph validation:
   - exactly one start node
   - invalid edge endpoint
   - unreachable action node
   - unbounded `while`/`repeat_until`
   - unsupported executable node reports a blocking issue
2. Add failing Rust compiler tests:
   - linear action path compiles to ordered action configs.
   - `if` node compiles to `ActionConfig::IfCondition`.
   - `repeat_times`, `repeat_for_each`, and `retry` compile to existing nested action configs.
   - safety nodes compile to safe existing actions where possible: `manual_approval` to `pause_for_human`, `rate_limit` to duration `wait`.

## Implementation Notes

- Keep compiler deterministic by sorting edges and using explicit port names.
- Compile supported nodes to existing `ActionConfig` variants first.
- Do not compile unsupported advanced nodes to no-ops.
- Preserve graph node ids in compiled metadata for timeline mapping.

## DONE Criteria

- `cd src-tauri && cargo test --test domain_validation` passes.
- `cd src-tauri && cargo test --test command_api` passes for compile/run graph cases.
- Compile errors are field-addressable enough for frontend display.
