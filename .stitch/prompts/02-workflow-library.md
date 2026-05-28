# Workflow Library

Use the applied Mission Control design system for visual styling; do not create a marketing page. Keep the product framed as a desktop Electron operations workspace. Include the persistent shell: left navigation with Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings; environment and diagnostics area; operator profile; and a main command bar with page context, command/search entry, environment badge, alerts shortcut, and page primary action. Primary target is a 1440 x 1024 desktop frame. Represent compact 1024 x 768 behavior inside the design through an icon-rail, drawer, stacked split view, or hidden secondary metadata where relevant. Use readable labels and icons for every active, completed, warning, failed, paused, skipped, and destructive state.

Create the Workflows library screen for discovering and managing automations before authoring.

PLATFORM: Web app, desktop-first.

PAGE STRUCTURE:
1. Header: title "Workflow Library", search, status/tag/owner/environment filters, and primary "New Workflow" action.
2. Main table: workflow name, last run, health, active schedule, identity, owner/update context, and row actions.
3. Selected preview panel: recent runs, active schedule, browser identity posture, shortcut actions to open graph, launch run, duplicate, import/export, archive/delete.
4. Empty state variant embedded in the page for first creation action.
5. Compact behavior: preview becomes a drawer, low-priority columns hide, and row actions remain accessible icon controls with tooltips.
