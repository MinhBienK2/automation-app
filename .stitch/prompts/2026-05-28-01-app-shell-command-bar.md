---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "App Shell And Command Bar"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign the Mission Control Electron desktop app shell as a precise internal
operations workspace. Use the applied Mission Control design system for all
visual styling; do not include custom colors, fonts, token values, marketing
hero content, decorative gradients, or unsupported future features.

PLATFORM: Desktop web app shell for an Electron application.

PAGE STRUCTURE:
1. Persistent left sidebar:
   - Product logo and Mission Control title.
   - Navigation in this exact order: Overview, Workflows, Runs, Evidence,
     Schedules, Identities, Settings.
   - Full mode uses icon plus label.
   - Collapsed compact mode uses icon rail with tooltip labels.
   - Active item is visually distinct and easy to scan.
2. Main command bar:
   - Sticky at top of the main content region.
   - Current page context label.
   - Local Lab status badge.
   - Global search input for workflows, runs, evidence, schedules, identities.
   - Alerts button with count badge when nonzero.
3. Search popover:
   - Dense command-menu layout.
   - Result type, primary label, and context text.
   - Empty state for no matches.
   - Hover/selected result state.
4. Content canvas:
   - Stable scrollable main region under the command bar.
   - No page-level horizontal overflow.

COMPACT DESKTOP:
- Show 1024x768 behavior with collapsed sidebar or stacked command bar.
- Keep search and alerts usable.
- Hide or compress secondary metadata before hiding primary navigation.

ACCEPTANCE CRITERIA:
- Sidebar order matches the product invariant.
- Overview can read as the default first screen.
- Command search has result and empty states.
- Shell feels dense and operational, not like a marketing app.
