# Graph Builder Validation Failure Overlay

Use the applied Mission Control design system for visual styling; do not create a marketing page. Keep the product framed as a desktop Electron operations workspace. Include the persistent shell: left navigation with Overview, Workflows, Runs, Evidence, Schedules, Identities, Settings; environment and diagnostics area; operator profile; and a main command bar with page context, command/search entry, environment badge, alerts shortcut, and page primary action. Primary target is a 1440 x 1024 desktop frame. Represent compact 1024 x 768 behavior inside the design through an icon-rail, drawer, stacked split view, or hidden secondary metadata where relevant. Use readable labels and icons for every active, completed, warning, failed, paused, skipped, and destructive state.

Create a Graph Builder state showing a validation or runtime failure detail overlay with return-to-fix behavior.

PLATFORM: Web app, desktop-first.

PAGE STRUCTURE:
1. Background: Graph Builder canvas with the affected node visible and still showing its problem state plus a secondary selection indication.
2. Overlay dialog: error or validation summary, node/step relationship, affected run ID or validation scope, and concise operator guidance.
3. Technical details: collapsed by default with Copy Details action; keep the raw payload visually subordinate.
4. Evidence preview: include a relevant screenshot/log/challenge observation thumbnail when available.
5. Actions: primary "Go to Node", secondary "Open Evidence", and Cancel/Close.
6. Compact behavior: overlay becomes a full-height drawer; graph node remains visible when possible.
