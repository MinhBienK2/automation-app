# Plan 01 - App Scaffold

## Goal

Create a runnable Rust desktop app skeleton using Tauri 2, React, and TypeScript.

This plan is only about the app shell. It must not implement workflow storage, runner logic, or the full UI.

## Scope

Create:

- Tauri 2 app structure.
- React + TypeScript frontend.
- Rust command bridge with one test command.
- Basic app window.
- App data directory resolver.
- Initial dependency setup.

## Rust Dependencies

Add the baseline dependencies needed by later plans:

- `tauri`
- `tokio`
- `serde`
- `serde_json`
- `thiserror`
- `uuid`
- `time` or `chrono`
- `sqlx` with SQLite and migration support
- `chromiumoxide`

## Frontend Dependencies

Add:

- React.
- TypeScript.
- Vite.
- Tauri frontend API package.
- Drag/drop package, likely `@dnd-kit/core`, if the scaffold already supports installing frontend deps.

## Tasks

- Scaffold the Tauri app.
- Create a minimal home screen.
- Add one Rust command such as `ping() -> "pong"`.
- Invoke `ping()` from the frontend.
- Add app data path resolver in Rust.
- Add a short README section with dev commands if README exists or is created in this plan.

## DONE Gate

This plan is DONE when:

- The app launches in dev mode.
- The frontend successfully calls a Rust command.
- Rust can resolve an app data directory.
- `cargo test` passes.
- Frontend typecheck or build passes.
- No workflow feature logic has been started yet.

## Checks

Run the checks that exist after scaffolding:

```text
cargo test
npm run build
```

If the scaffold uses different commands, document them before committing.

## Stop Rule

Stop after the shell runs and the bridge works. Do not start database, workflow model, UI builder, or browser automation work in this plan.
