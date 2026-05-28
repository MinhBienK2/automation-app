---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Graph Builder"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign the Workflow Detail / Graph Builder workspace for authoring and
running visual automation graphs. Use current behavior only: edit graph,
add/connect nodes, inspect node/link, save, validate, launch full run, run from
selected when eligible, record replacement, stop active run, show issues, and
show graph save/run progress.

PLATFORM: Desktop web app screen.

PAGE STRUCTURE:
1. Header:
   - Back/breadcrumb to Workflows.
   - Workflow name with safe truncation.
   - Save status chip.
   - Run status bar.
   - Actions: Settings icon, Validate icon, Save icon, Run from selected when
     visible, Record Replacement, Launch Run primary, Stop destructive when
     running.
2. Issue panel:
   - Below header and above graph when issues or stale recheck state exist.
   - Group blocking validation, runtime failure, and system/startup errors.
   - Each row shows severity, summary, affected node/link when present, and
     actions such as Go to node/link, Validate again, Save again, Run again,
     Copy details.
   - Long raw details remain collapsed.
3. Graph toolbar:
   - Undo, redo, select mode, pan mode, fit view, auto arrange, shortcuts.
   - Creation buttons: New node, Add Action, Add Logic, Add Variable, Add End.
4. Canvas:
   - Central graph canvas with subtle grid, visible ports, zoom controls,
     minimap, and stable height.
   - Node and edge states remain readable during run progress.
5. Inspector:
   - Right-side tool panel with selected node/link/multi-selection states.
   - Empty selection state explains what to select.
   - Node selected: title/type, status, config fields, action guide, run error
     summary when applicable.
   - Link selected: link wait editor, source/target, link actions.
   - Multi-selection: selection count and bulk duplicate/copy/delete actions.
6. Node state semantics:
   - Selected node gains a secondary selection ring.
   - Running uses active execution indication.
   - Completed uses success state.
   - Validation/stale uses attention state.
   - Failed uses failure state.
   - Selected failed/issue nodes keep their failure/attention state and only
     add secondary selection emphasis.

DIALOGS AND POPOVERS:
- Launch Run confirmation.
- Add Action/Add Logic/Add Variable palette.
- Shortcuts dialog.
- Step Help / Action Guide.
- Node/link context menu if represented.

COMPACT DESKTOP:
- Inspector becomes drawer or bottom panel.
- Toolbar wraps while preserving canvas usability.
- Palettes fit inside viewport and scroll internally.

ACCEPTANCE CRITERIA:
- Header commands no longer compete visually.
- Issue panel is persistent and scannable.
- Canvas, toolbar, and inspector have clear boundaries.
- Problem states are not overwritten by selection color.
