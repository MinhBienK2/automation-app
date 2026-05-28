# 2026-05-28 Screen-By-Screen Stitch Prompt Index

Source spec:
`docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md`

Project:
- Title: Mission Control Automation Suite
- Project ID: `17656305095080667375`
- Design system: `assets/1363258223077507509`
- Device type: `DESKTOP`

Use these prompts one at a time in Stitch. The project already has the Mission
Control design system applied, so these prompts intentionally avoid repeating
hex colors, font names, and token values.

Recommended order:

1. `2026-05-28-01-app-shell-command-bar.md`
2. `2026-05-28-02-overview.md`
3. `2026-05-28-03-workflow-library.md`
4. `2026-05-28-04-graph-builder.md`
5. `2026-05-28-05-workflow-settings-dialog.md`
6. `2026-05-28-06-recording-review-help-popups.md`
7. `2026-05-28-07-runs.md`
8. `2026-05-28-08-evidence-explorer.md`
9. `2026-05-28-09-identity-lab.md`
10. `2026-05-28-10-schedules.md`
11. `2026-05-28-11-app-settings.md`
12. `2026-05-28-12-css-responsive-polish.md`

Generation rule:

- For new screens, use `generate_screen_from_text` with `deviceType: DESKTOP`
  and the design system id above.
- For existing screens, use `edit_screens` against the matching current screen.
- Prefer targeted edits over full regeneration when only one region is wrong.
- Always check desktop `1440x1024` intent and compact desktop `1024x768`
  behavior.
