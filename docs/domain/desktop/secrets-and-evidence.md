# Secrets and Evidence on the Desktop Surface

What a desktop run is allowed to record. Resolves [#46](https://github.com/MinhBienK2/automation-app/issues/46).

## The finding that reshaped this

The ticket was written assuming the risk was screenshots — a bitmap of a password field that no key-pattern redaction can see inside.

That risk is real. It is also the smaller one.

`get_window_state` returns a `value` field per element. For a text editor, the `Document` element's `value` is **the entire contents of the open file**. During verification probing, launching Notepad restored the operator's previous tabs and the accessibility tree returned the full contents of a file holding live credentials — as plain text in `structuredJson`, **with no screenshot taken at all**.

The existing evidence model redacts by key pattern. A key pattern cannot see inside a `Document`'s `value`: the key is `value`, and its content is arbitrary.

So the policy covers **the tree first, screenshots second**. Getting this backwards would have shipped a leak that looked handled.

It happened again on 2026-08-15, on the first day the client ran against a real driver. A probe called `launch_app({name: "notepad"})`; Notepad restored a tab holding API recovery keys, and the tree's `value` carried the file through the probe's own output. Same mechanism, same application, a different operator's secret. That is not a coincidence to note — it is what "restores the previous tabs" means in practice, and it is why **Notepad is not a safe application to demonstrate anything with**.

### The tree comes back twice

`get_window_state` also returns **`tree_markdown`**: the whole tree a second time, rendered as markdown, 38 KB for a File Explorer window. It sits in the same payload as `elements`, and it carries the same labels. The driver's own `_note` says to prefer the structured side.

Nothing in this document knew about that field when it was written, which is the argument for the enforcement being structural rather than procedural: `parseSnapshot` validates against a Zod object schema, and Zod strips what the schema does not name. `tree_markdown` never reaches a caller — not because anyone decided to drop it, but because nothing asked for it. A policy of "remember not to persist the tree" would have missed a field nobody knew existed.

## Element snapshots are never evidence by default

An Element Snapshot is working state for resolving a locator. It is not a record of what happened, and it is the richest source of incidental secrets in the system.

- Snapshots are **not** persisted to run outputs, run steps, or the evidence directory.
- Traces record what a step *did* — the locator it resolved, the role and label it matched, the verification verdict — never the snapshot it resolved against.
- The `value` field is read only when an action asks for it (`desktop_read_text`), and then only for the element that action targeted.

The operator can opt a step into capturing its snapshot for debugging. It is off by default, marked on the step, and subject to the same redaction as everything else.

## Screenshots are window-scoped, always

A desktop run happens while the operator is using the machine. A full-screen capture would record their mail, their chat, their password manager — none of which the workflow touched.

`cua-driver`'s Driver Session takes a `captureScope`, and `Window` is the answer:

```js
await driver.startSession({ session: runId, captureScope: CaptureScope.Window });
```

Verified: the session reports `effectiveScope: Window` and `desktopUnlocked: false`. Scope is **immutable for the life of a session**, so a run cannot widen it later, accidentally or otherwise. Desktop runs start their session in `Window` scope and never escalate.

This resolves the open question the ticket raised, and it resolves it at the driver rather than by cropping after the fact — the wider image is never captured.

## Sensitivity is per step, and defaults to on where it can be inferred

Screenshots are captured by default with a per-step sensitivity flag that suppresses them, as decided. Left there, the policy has one bad failure mode: forgetting the flag once writes a password to disk permanently.

So the flag **defaults to on** when the target's accessibility metadata says it is a password control — UIA exposes this, and the snapshot the action already takes carries it. The operator keeps the decision; the system stops the obvious mistake without being asked.

Where an action types a value drawn from secret storage, sensitivity is forced on regardless of the target's metadata. The provenance of the value is decisive, not the shape of the control.

## Failure screenshots respect the flag

The runner captures a screenshot when an action fails. That path currently bypasses any step-level policy, which means a failing password step would produce exactly the artifact the flag exists to prevent — at the moment things are already going wrong.

Failure capture reads the same flag. A sensitive step that fails records the failure, the locator, and the verification verdict, with no image.

## Redaction of read values

`desktop_read_text` writes what it read into a named output, and outputs flow into evidence. The existing sensitive-key redaction applies to the output name, which the operator controls.

Two additions, because the operator naming an output `notes` does not make its contents safe:

- A step reading from a password-typed control is refused. If the intent is to move a secret, that is what secret storage is for.
- Read values are subject to the existing evidence classification before persistence, so patterns that look like credentials are redacted regardless of the output's name.

## Where secrets come from

Workflows that type a password draw it from the existing app-level secret storage, never from a literal in the graph. The graph is exported, imported, and shared as a package; a literal secret in a node travels with it.

Values from secret storage are marked at the point of use, which is what drives forced sensitivity above.

## Summary of defaults

| Thing | Default | Overridable |
|---|---|---|
| Element Snapshot persisted | No | Yes, per step, marked |
| Screenshot scope | Bound window | No |
| Screenshot on normal steps | Captured | Yes, per step |
| Screenshot on password-typed targets | Suppressed | Yes, explicitly |
| Screenshot on failure | Follows the step's flag | No |
| Reading a password control | Refused | No |
| Secret values in the graph | Refused | No |
