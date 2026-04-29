# Action Taxonomy

## Source Files

- TypeScript union: `src/types/workflow.ts`
- UI labels/groups: `src/lib/workflowUi.ts`
- Rust enum/config: `src-tauri/src/domain/action_config.rs`
- Defaults: `src-tauri/src/services/run_service.rs`
- Runner dispatch: `src-tauri/src/runner/actions/mod.rs`

## UI Groups

Current action groups are defined in `src/lib/workflowUi.ts`:

- Core: navigation, input, clear, wait.
- Forms: select, checkbox/radio, upload, submit, custom option, contenteditable.
- Keyboard: key, hotkey, sequence typing, focus, clipboard.
- Pointer & Scroll: click, scroll, hover, double click, right click, drag and drop.
- Data: extraction and screenshots.
- Browser: navigation history, tabs, frames, dialogs, downloads.
- Logic: variables, assertions, conditions, loops, retries, stop.
- Session: profiles, sessions, cookies, secrets.
- Network: proxy, user agent, viewport, geolocation, headers, permissions.
- Human Verification: challenge detection and manual pause/resume.
- Reliability: fallback selector, retry step, checkpoint.
- Advanced: JavaScript, network wait/block/mock, storage.
- Removed legacy actions: `open_url`, `sleep`, and `type_text` are migrated or normalized to `navigate`, duration `wait`, and `input_text`.

## Change Rule

When adding or changing an action, keep these in sync:

- TypeScript `ActionType` and `ActionConfig`.
- Rust `ActionType` and `ActionConfig`.
- UI label, group, summary, and form behavior.
- Default config.
- Validation.
- Runner execution.
- Persistence JSON compatibility.
- Command and domain tests.
- Smoke checklist when user-visible behavior changes.

Do not infer current actions from `docs/superpowers`; verify code.
