# Plan 02 - Domain And Validation

## Goal

Define the Rust domain model for workflows, steps, action configs, run status, and validation.

This plan creates the core types without SQLite, Tauri commands, UI, or browser automation.

## Scope

Create modules similar to:

- `domain/workflow.rs`
- `domain/step.rs`
- `domain/action_config.rs`
- `domain/validation.rs`
- `errors.rs`

## Types

Define:

- `Workflow`
- `WorkflowStep`
- `ActionType`
- `ActionConfig`
- `ScrollDirection`
- `RunStatus`
- `RunError`

Action config shape:

```rust
enum ActionConfig {
    OpenUrl { url: String },
    Sleep { seconds: f64 },
    TypeText { xpath: String, text: String },
    Click { xpath: String },
    Scroll { direction: ScrollDirection, pixels: i64 },
}
```

## Validation Rules

- Workflow name is required.
- Step type is required.
- Open URL requires non-empty URL.
- Sleep seconds must be greater than 0.
- Type Text requires XPath and text.
- Click requires XPath.
- Scroll requires `up` or `down` direction and pixels greater than 0.

## Tasks

- Add serializable Rust structs/enums.
- Add validation functions.
- Add structured error types suitable for frontend messages.
- Add unit tests for valid and invalid configs.
- Add JSON round-trip tests for every action config.

## DONE Gate

This plan is DONE when:

- All MVP action configs are represented.
- Validation covers every required field.
- Errors are structured and frontend-safe.
- Config JSON round-trip tests pass.
- `cargo test` passes.
- No database, UI, or runner implementation has been started.

## Checks

```text
cargo test
cargo fmt --check
cargo clippy --all-targets --all-features
```

If clippy is too noisy during early scaffold, either fix the issues or document the exact reason before committing.

## Stop Rule

Stop after the domain model is tested. Do not add persistence in this plan.
