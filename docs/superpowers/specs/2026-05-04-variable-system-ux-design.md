# Variable System UX Design

## Status

Approved for specification by the user on 2026-05-04 after brainstorming.

## Problem

The current `Set Variable` graph node stores only one `name/value` pair. Users must create and connect multiple nodes to set several variables, which makes graphs noisy. The current variable model is also not obvious for JSON, arrays, overwrite behavior, loop usage, or inserting variables into other fields.

Users need a faster, clearer way to define variables, define JSON data, reuse variables in inputs, and loop over array variables.

## Goals

- Keep two separate variable authoring nodes:
  - `Set Variables`
  - `Set JSON Variables`
- Use one shared internal JSON/object-based variable storage path for both nodes.
- Allow `Set Variables` to define multiple variables in one node.
- Allow variable names to use dot paths, such as `user.name`.
- Allow overwrite by execution order: later writes to the same path replace earlier values.
- Make value type explicit in `Set Variables` so text, JSON, arrays, numbers, and booleans are not ambiguous.
- Allow `Set JSON Variables` to flatten object keys into dot-path variables.
- Keep arrays from JSON as arrays at their key; do not flatten array indexes.
- Add `Repeat For Each` support for looping over an array variable in order.
- Add variable token highlighting for `{{variable.path}}`.
- Add a variable picker/insert experience so users can click a variable to insert it into supported fields.

## Non-Goals

- Do not persist variables across independent workflow runs.
- Do not introduce global app-level variables in this spec.
- Do not flatten arrays into `items.0.name` paths.
- Do not remove support for existing single `set_variable` saved graphs.
- Do not require users to use the variable picker; manual typing like `{{user.name}}` remains supported.

## Variable Model

Variables are addressed by string paths.

Examples:

```text
token
user.name
user.profile.email
roles
```

Rules:

- A name without `.` is a top-level variable.
- A name with `.` is a dot-path variable.
- Later writes overwrite earlier writes at the same path.
- Template usage keeps the current shape: `{{token}}`, `{{user.name}}`, `{{roles}}`.
- Arrays are stored as arrays at their path.
- When an array is rendered into a text template, it should render as JSON text unless a later implementation adds richer formatting controls.

## Node 1: Set Variables

`Set Variables` replaces the current single-value editing experience with a multi-row table.

UI columns:

```text
Name        Type      Value
user.name   Text      fomatso
roles       JSON      ["admin", "editor"]
enabled     Boolean   true
age         Number    20
```

Supported row types:

- `Text`: stores the value exactly as text after template rendering.
- `JSON`: parses the value as JSON; arrays and objects stay typed.
- `Number`: parses the value as a number.
- `Boolean`: stores true/false.

Important distinction:

```text
roles | Text | ["admin", "editor"]
```

stores the literal text `["admin", "editor"]`.

```text
roles | JSON | ["admin", "editor"]
```

stores an array with two items.

Compilation/runtime behavior:

- The table converts to a shared internal JSON/object representation.
- Dot-path names create nested object paths internally.
- The shared variable writer flattens object paths for template/output access.
- If two rows write the same path, the later row in the same node wins.
- If a later node writes the same path, the later node wins.

Validation:

- Each row requires a non-empty `Name`.
- `JSON` rows must parse as valid JSON.
- `Number` rows must parse as finite numbers.
- `Boolean` rows must be true/false.
- Duplicate paths are allowed, but the UI should show a non-blocking warning that the later row overwrites the earlier row.

## Node 2: Set JSON Variables

`Set JSON Variables` is for users who already have structured data.

UI:

```json
{
  "user": {
    "name": "fomatso",
    "email": "a@b.com"
  },
  "roles": ["admin", "editor"]
}
```

Runtime output:

```text
user.name = fomatso
user.email = a@b.com
roles = ["admin", "editor"]
```

Rules:

- The JSON root must be an object.
- Objects are flattened into dot-path variables.
- Arrays are stored whole at their key.
- Arrays are not expanded into index paths.
- Invalid JSON blocks validation/run with a clear error.

No root or prefix field is required. Users control the names by writing the JSON object shape.

## Repeat For Each Array Variables

`Repeat For Each` should gain an item source mode.

Modes:

```text
Items source
- Manual list
- Variable array
```

Manual list keeps current behavior.

Variable array mode:

```text
Array variable: roles
Item name: role
```

If:

```json
{
  "roles": ["admin", "editor"]
}
```

The loop runs in array order:

```text
loop 1: role = admin
loop 2: role = editor
```

If array items are objects:

```json
{
  "users": [
    { "name": "A" },
    { "name": "B" }
  ]
}
```

Then each loop item should be available as:

```text
user
```

and object fields should be exposed for template use as:

```text
user.name
```

Validation:

- Variable array mode requires a non-empty array variable name.
- Runtime fails clearly if the variable is missing or is not an array.
- Loop order follows the array's index order.

## Variable Insert UX

Supported text inputs and textareas should make variables easier to use.

Requirements:

- Template tokens such as `{{user.name}}` must be visually highlighted.
- Highlight color should use the existing green accent and monospace treatment.
- Users should be able to open a variable picker near supported inputs.
- Clicking a variable inserts `{{variable.path}}` at the cursor position.
- Search should filter variable names.
- The picker should group variables by source when possible:
  - Set Variables
  - Set JSON Variables
  - Capture outputs
  - Loop current item
  - System outputs

Implementation note:

- Native `<input>` and `<textarea>` cannot style only part of their text.
- Use a small template editor component or an overlay highlighter for fields that support templates.
- Keep keyboard editing and copy/paste behavior reliable.
- If rich highlighting is too large for the first implementation slice, start with a variable picker plus preview/highlight layer for the most important fields, then expand.

## Data And Compatibility

Current saved graphs with single `set_variable` nodes must keep loading.

Compatibility options:

- Treat old config `{ name, value }` as one-row `Set Variables`.
- Persist new multi-variable config as a new graph node type or as an evolved `set_variable` config with backward-compatible parsing.
- Add a new action config variant only if needed for Rust serde clarity.

Recommended naming:

- User-facing node: `Set Variables`
- User-facing node: `Set JSON Variables`
- Internal node/type names should be chosen during implementation to preserve compatibility and avoid confusing existing `set_variable` saved data.

## Documentation Updates During Implementation

Update:

- `docs/contracts/workflow-types.md` for graph node types, ports, and config shapes.
- `docs/contracts/action-configs.md` if Rust/TypeScript action config variants change.
- `docs/domain/workflow-lifecycle.md` for Add Variable behavior.
- `docs/domain/user-visible-invariants.md` for variable overwrite, template insertion, and array loop behavior.
- `docs/architecture/frontend.md` for variable editor/picker ownership.
- `README.md` smoke checklist for Set Variables, Set JSON Variables, variable picker, and Repeat For Each array mode.

## Testing

Implementation must use TDD.

Focused test coverage:

- Existing single `set_variable` config loads as one row.
- `Set Variables` can store multiple rows.
- `Text` row preserves JSON-looking text as text.
- `JSON` row parses arrays/objects.
- Duplicate variable paths overwrite in row execution order.
- `Set JSON Variables` requires root object.
- `Set JSON Variables` flattens nested objects into dot paths.
- Arrays from JSON stay whole at their key.
- Later variable nodes overwrite earlier paths.
- `Repeat For Each` manual list keeps current order.
- `Repeat For Each` variable array loops in array order.
- Variable array mode errors clearly for missing or non-array variables.
- Template rendering supports `{{user.name}}` and array values.
- Variable picker inserts token at the cursor.
- Variable token highlighting renders without breaking text editing.

## Acceptance Criteria

- Users can define multiple variables in one `Set Variables` node.
- Users can define structured JSON in one `Set JSON Variables` node.
- Text versus array/object values are explicit through the `Type` column.
- Dot-path variables behave consistently across table, JSON, templates, and conditions.
- Arrays are preserved and can be used by `Repeat For Each`.
- Users can quickly insert variables into supported fields.
- `{{variable}}` tokens are visually recognizable.
- Existing saved `set_variable` graphs remain compatible.

## Self-Review

- No placeholders remain.
- The design preserves the user's request to keep two nodes while sharing one JSON-based internal logic.
- Array behavior is explicit.
- Overwrite behavior is explicit.
- UI requirements cover both fast table entry and JSON entry.
