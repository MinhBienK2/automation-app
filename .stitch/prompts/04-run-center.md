# Run Center

Use the applied Mission Control design system for visual styling; do not create a marketing page. Keep the product framed as a desktop Electron operations workspace. Include the persistent shell: left navigation with Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings; environment and diagnostics area; operator profile; and a main command bar with page context, command/search entry, environment badge, alerts shortcut, and page primary action. Primary target is a 1440 x 1024 desktop frame. Represent compact 1024 x 768 behavior inside the design through an icon-rail, drawer, stacked split view, or hidden secondary metadata where relevant. Use readable labels and icons for every active, completed, warning, failed, paused, skipped, and destructive state.

Create the Runs workspace for monitoring active and historical execution across workflows.

PLATFORM: Web app, desktop-first.

PAGE STRUCTURE:
1. Header: title "Run Center", tabs Active, Completed, Failed, and a time range control.
2. Filters: workflow, identity, environment, and run source.
3. Split layout: run list on the left and selected-run detail on the right.
4. Detail timeline: step status, duration, current step, artifact markers, error summaries, challenge observations, and identity/session metadata.
5. Controls: Stop for active runs, Open Evidence, Open Workflow, and Copy Run ID.
6. Compact behavior: selected run detail stacks below the run list; only essential run metadata remains in the list.
