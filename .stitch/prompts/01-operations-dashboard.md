# Operations Dashboard

Use the applied Mission Control design system for visual styling; do not create a marketing page. Keep the product framed as a desktop Electron operations workspace. Include the persistent shell: left navigation with Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings; environment and diagnostics area; operator profile; and a main command bar with page context, command/search entry, environment badge, alerts shortcut, and page primary action. Primary target is a 1440 x 1024 desktop frame. Represent compact 1024 x 768 behavior inside the design through an icon-rail, drawer, stacked split view, or hidden secondary metadata where relevant. Use readable labels and icons for every active, completed, warning, failed, paused, skipped, and destructive state.

Create the default Overview screen as a working operations dashboard.

PLATFORM: Web app, desktop-first.

PAGE STRUCTURE:
1. Header: page title "Operations Overview", last refreshed timestamp, environment filter, and primary "Launch Run" action.
2. KPI row: Active Runs, Succeeded Today, Attention Needed, Upcoming Schedules.
3. Main grid: a large Live Operations panel listing running workflow, identity, current step, elapsed time, and state; an Attention Queue covering validation failures, execution failures, identity warnings, challenge observations, and failed schedules.
4. Supporting regions: Execution Activity timeline/chart, Recent Evidence artifact preview cards with traceability, and Upcoming Schedules list.
5. Compact behavior: dashboard reduces to two columns, less important table metadata hides first, and attention items stay visible above evidence previews.
