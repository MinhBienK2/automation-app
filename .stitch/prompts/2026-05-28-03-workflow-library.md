---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Workflow Library"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign the Workflows screen as a dense workflow library and management
workspace. Use only current capabilities: list workflows, create, record,
import, view, run saved workflow, stop active workflow, edit settings,
duplicate, export, and delete.

PLATFORM: Desktop web app screen.

PAGE STRUCTURE:
1. Header:
   - Eyebrow "Mission Control Workspace".
   - Page title "Workflows".
   - Summary chips for workflow count and active run count.
   - Actions: Import Workflow, Record Workflow, Create Workflow.
   - Create Workflow is the strongest action.
2. Library region:
   - Use a dense table/list hybrid instead of large cards.
   - Primary fields: workflow name, active run status, last session status when
     available, schedule/identity context when available, row actions.
   - Clicking row title or View action opens workflow detail.
3. Row actions:
   - View Details.
   - Run.
   - Stop when active.
   - Edit.
   - Duplicate.
   - Export.
   - Delete.
   - Dense actions use icon-only buttons with tooltip labels.
4. Active workflow row:
   - Running status is scoped to that workflow.
   - Stop action is destructive and clearly scoped to that row.
   - Run, Duplicate, Export, and Delete are disabled with visible reason.
5. Optional selected preview:
   - If space allows, right-side preview with selected workflow context, recent
     run status, identity summary, and primary shortcuts.
   - Do not invent unavailable product data.
6. Empty state:
   - "No workflows yet".
   - Create Workflow primary action.
   - Record Workflow secondary action.

DIALOGS:
- Create Workflow.
- Edit Workflow.
- Import package preview.
- Export package options.
- Delete workflow/profile-data confirmation.

COMPACT DESKTOP:
- Row action strip wraps without layout shift.
- Hide secondary metadata first.
- Preview becomes drawer or is omitted.

ACCEPTANCE CRITERIA:
- Main actions are visually ranked.
- Icon clusters remain understandable.
- Active-run behavior is visually scoped to one workflow.
