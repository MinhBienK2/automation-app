# Token Budget

## Reading Rule

Do not read the whole docs tree by default.

Read:

1. `docs/README.md`
2. `docs/task-routes.md`
3. Only docs named by the selected task route.
4. Focused source files named by the route.

## Why

Mandatory docs sync increases upfront reading slightly. Route-based reading reduces broad code exploration and stale-spec drift.

## Keep Docs Cheap

- Keep route docs concise.
- Prefer file paths and checklists.
- Link to source files instead of copying code.
- Do not put old plans or phase notes in current docs.
- Move detailed historical context to `docs/superpowers` only when needed.

## Multi-Area Tasks

Read only the routes for touched areas. If a task starts in one area and reveals another affected area, read that route then continue.
