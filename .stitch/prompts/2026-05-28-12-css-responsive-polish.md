---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "edit"
target: "CSS And Responsive Polish Pass"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Perform a final UI consistency and responsive polish pass across the Mission
Control app after the screen redesigns. Use the applied Mission Control design
system; do not add custom theme tokens or unsupported features.

EDIT SCOPE:
1. Replace one-off legacy visual treatments with the applied design system.
2. Remove legacy recording-review styling and align it with the Mission
   Control popup system.
3. Standardize control, panel, card, and dialog geometry.
4. Standardize page header anatomy across all workspaces.
5. Standardize button hierarchy and icon-only tooltip treatment.
6. Standardize dialog anatomy and viewport clamping.
7. Standardize status pills and semantic tones.
8. Standardize field labels, help text, and validation messages.
9. Standardize empty, loading, error, warning, and stale-target states.
10. Verify compact desktop behavior:
    - Sidebar collapses or stacks without horizontal overflow.
    - Command bar remains usable.
    - Tables scroll internally.
    - Dialogs fit viewport.
    - Graph canvas remains usable.
    - Inspector and palettes do not crush fields.
11. Ensure text never overlaps controls or adjacent content.
12. Ensure long workflow names, run ids, identity ids, paths, and error text
    truncate or wrap intentionally.

DO NOT ADD:
- Decorative orbs.
- Marketing hero sections.
- New product areas.
- Theme switchers.
- Notification systems.
- Global policy editors.
- Unsupported future features.

ACCEPTANCE CRITERIA:
- No screen reads as a separate visual system.
- No page-level horizontal overflow at compact desktop width.
- Dialogs and popovers stay inside viewport.
- Long technical text is contained.
- State semantics remain consistent.
