# Desktop Evidence Model

What a desktop run records, and where each thing lands. Resolves [#52](https://github.com/MinhBienK2/automation-app/issues/52).

Read [secrets and evidence](secrets-and-evidence.md) first — it establishes the constraint this document works inside, and that constraint is not the obvious one.

## The three-way split

A desktop run produces four kinds of thing. They are not four kinds of evidence.

| Produced by a run | Where it goes | Why |
|---|---|---|
| Window screenshot | **Evidence item**, `generated_output` | An artifact on disk the operator asked for |
| `desktop_read_text` value | **Evidence item**, `window_observation` | The step's whole purpose is to record it |
| Resolved locator, `verify_state` verdict, Capability Tier | **Run step trace** | Explains *how* a step behaved, not what happened |
| Element Snapshot | **Nowhere** | The largest incidental-secret source in the system |

The line between the middle two is the one worth stating: evidence is what the workflow was asked to collect, trace is what the system did to collect it. A locator that resolved by ancestry rather than by name is not a finding about the world; it is a fact about the run, and it belongs on the step where a later failure can be compared against it.

## Element Snapshots are structurally unable to be persisted

[#46](https://github.com/MinhBienK2/automation-app/issues/46) decided snapshots are never evidence by default. A policy is not enough here, because the leak is one line of code away: `get_window_state` returns the tree and the screenshot in the *same payload*, and a `Document` element's `value` is the whole open file.

So the enforcement is in the type, not in a rule someone has to remember:

- `DesktopDriverClient.captureWindow` returns **a base64 string**, not the response. The tree that came back with it is dropped inside the client, and no caller can reach it.
- `DesktopStepTrace` has no `value` field. It carries `role`, `label`, how the match was made, the tier and the verdict — every field derived from the resolution rather than copied from the snapshot.
- `desktop_read_text` reads `value` for **one** element: the one its locator resolved. That value flows into a named output and is subject to the existing evidence classification before persistence.

## `window_observation` is a category, not a view

The Evidence Explorer filters by category. Desktop adds one value to that filter rather than a second Explorer, which is ADR-0001's default and is right here: an operator comparing a web run with a desktop one should not change screens to do it.

It is a distinct value rather than reusing `page_observation` because the two differ in the way that matters to someone reading a run afterwards: **a page observation can be re-derived from a URL; a window observation cannot be re-derived from anywhere.** A missing page observation is an inconvenience. A missing window observation is gone.

## Failure capture reads the step's flag

The web failure path bypassed step-level policy entirely, which meant a failing password step produced exactly the artifact the sensitivity flag exists to prevent — at the moment things were already going wrong.

The desktop path reads the same flag the step carries. A sensitive step that fails records the failure, the locator and the verdict, and no image. The image is **not captured and then discarded**: a captured image has already existed in the driver's memory and its logs by the time we could drop it.

## Export bundle

Desktop adds no new sanitisation stage. It adds:

- Screenshot artifacts under the run's existing `screenshots/` directory, already covered by the bundle's artifact-path validation.
- `window_observation` entries in the output manifest, redacted by the same key-pattern and value-classification rules as everything else.

What a bundle must never contain is unchanged and now unreachable: there is no Element Snapshot anywhere in the persisted model to leave the machine.

## Not settled here

- **The screenshot response shape is inferred.** `include_screenshot: true` was exercised during research but its response was never recorded, so `captureWindow` reads three plausible field names and reports an unreadable answer rather than writing an empty file. First thing to confirm when the slice runs on Windows.
- **Opt-in snapshot capture for debugging** is specified in `secrets-and-evidence.md` and not built. It needs a per-step flag, a redaction pass over element values, and a place in the Explorer that reads as "debug", not "evidence".
