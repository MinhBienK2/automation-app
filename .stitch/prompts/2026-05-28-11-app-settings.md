---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "App Settings"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign App Settings as an app-level diagnostics and maintenance workspace.
Use current behavior only: graph autosave preference, environment readiness
diagnostics, refresh diagnostics, install CloakBrowser binary, cleanup orphaned
profiles, maintenance message, and graph shortcuts guide.

PLATFORM: Desktop web app screen.

PAGE STRUCTURE:
1. Header:
   - Eyebrow "Application".
   - Page title "Settings".
2. Layout:
   - Single-column or two-column operations settings layout.
   - Do not design a marketing settings page.
3. Graph Persistence panel:
   - Autosave graph changes switch.
   - Short description.
4. Environment Readiness panel:
   - Header with Refresh Diagnostics action.
   - Readiness grid: CloakBrowser, GeoIP, Headed display, Fingerprint fonts,
     Profiles, Smoke check.
   - Each readiness item has label, value, and semantic tone.
   - Diagnostics error/loading states are contained.
5. Maintenance panel:
   - Install CloakBrowser Binary.
   - Cleanup Orphaned Profiles.
   - Explanation that these operate on local lab runtime and inactive profiles.
   - Maintenance message status area.
6. Graph Shortcuts panel:
   - Shortcut groups for navigation, selection, editing, run/save.
   - Keyboard tokens and compact descriptions.

COMPACT DESKTOP:
- Readiness grid becomes one or two columns.
- Maintenance actions wrap.
- Shortcut guide becomes one column.

ACCEPTANCE CRITERIA:
- Settings does not introduce theme, notification, global policy, or retention
  systems that do not exist.
- Diagnostics are useful but do not expose raw local paths.
- Maintenance commands look guarded and local.
