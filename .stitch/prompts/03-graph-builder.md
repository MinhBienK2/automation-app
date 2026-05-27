# Graph Builder

Use the applied Mission Control design system for visual styling; do not create a marketing page. Keep the product framed as a desktop Electron operations workspace. Include the persistent shell: left navigation with Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings; environment and diagnostics area; operator profile; and a main command bar with page context, command/search entry, environment badge, alerts shortcut, and page primary action. Primary target is a 1440 x 1024 desktop frame. Represent compact 1024 x 768 behavior inside the design through an icon-rail, drawer, stacked split view, or hidden secondary metadata where relevant. Use readable labels and icons for every active, completed, warning, failed, paused, skipped, and destructive state.

Create the primary Graph Builder authoring workspace.

PLATFORM: Web app, desktop-first.

PAGE STRUCTURE:
1. Header: workflow name, save status, environment, Validate action, and Launch Run action.
2. Left palette: collapsible groups for actions, logic, variables, browser/session, network, and evidence-related nodes.
3. Center canvas: dot-grid graph canvas with connected nodes, ports, labels, zoom controls, minimap, selected node, active node, completed node, warning node, and failed node.
4. Right inspector: tabs Configure, Help, Run Output; show selected node settings, validation notes, and technical metadata.
5. Bottom execution rail: visible during a run with current step, elapsed time, issues, and captured evidence markers.
6. Compact behavior: palette and inspector become drawers; graph remains the dominant workspace.
