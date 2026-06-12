# Recording Invariants

Preserve these unless the task explicitly changes them.

## Security

- Never expose captured password or secret-like text field values to the renderer.
- Redacted input steps are generated excluded with review warning until operator supplies safe value.
- Sensitive pasted values are redacted and excluded until reviewed.

## Capture Rules

- Top-level page navigations can become `navigate` steps.
- Embedded frame navigations (ad/user-sync iframes) must NOT become workflow nodes.
- Text entry preserves literal whitespace and clearing.
- Contenteditable edits capture visible editor text.
- Text-composition, edit-hotkey, deletion-key, modifier-only keydown noise must NOT create nodes or split one entry into multiple Fill Field steps.
- Clipboard paste into non-sensitive targets: Set Clipboard + Paste steps, suppress duplicate input event.
- Generic clicks preceding checkbox/radio/select/upload events must NOT create duplicate click nodes.
- Tab from recorded click: click + tab switch. Tab without click: Open New Tab.

## Normalization

- Stopping drains buffered page-side fallback events before draft generation.
- Ordered locator candidates with weak-locator warnings.
- Deduped form-control clicks, text-editing keyboard noise suppression.
- Stable grouping for editable targets whose visible text changes while typing.

## Draft Generation

- Creates validated review-only v2 workflow graph with deterministic row-wrapped layout.
- Fixed edge delays for captured inter-step pacing.
- Does not persist a workflow or replace existing saved graph.

## Review And Save

- Workflow detail header does NOT expose Record Replacement.
- Review dialog: edit workflow name, step labels, inclusion flags, supported captured values.
- `saveRecordingDraft` honors: reviewed labels, inclusion, supported value edits, backend-held timing.
- `saveRecordingDraft` IGNORES: renderer-supplied action type, locator replacement, timing replacement.
- Save reconciles edits against backend-held draft steps by step id.
- Successful save and discard consume backend in-memory recorder state.

## Scheduling Context

- Scheduled runs use latest saved graph + settings at fire time; unsaved drafts not run.
- Schedules run only while Electron app is active. Missed occurrences skipped and recorded.
- Schedule skip reasons: `active_workflow`, `active_profile`, `active_batch`. One-time schedules disabled after skip.
- Isolated schedules can start concurrently.
- Enabled schedules require valid config + runnable workflow. Disabled drafts can point at incomplete workflows.
- Event history records: started, skipped, missed, failed-to-start, disabled. Independent from run evidence.
- History entries can open owning Workflow target. Stale target shows unavailable message.
