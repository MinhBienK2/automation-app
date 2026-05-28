---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Workflow Settings Dialog"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign the Workflow Settings dialog as a large, dense, structured settings
workspace. Use only current sections: General, Graph, Run Policy, Browser
Launch, Environment. Preserve dialog-level Save Settings and unsaved close
protection.

PLATFORM: Desktop web app dialog state.

PAGE STRUCTURE:
1. Modal frame:
   - Large viewport-clamped dialog.
   - Header, scrollable body, sticky footer.
2. Header:
   - Eyebrow "Workflow Settings".
   - Workflow name or active section title.
   - Dirty/save status.
   - Save Settings primary action.
   - Close icon.
3. Body:
   - Left section navigation: General, Graph, Run Policy, Browser Launch,
     Environment.
   - Main section content in grouped field panels.
   - Help region or help drawer for section guidance.
4. Section navigation:
   - Active section is clear.
   - Dirty section indicator.
   - Warning/validation count when present.
5. General:
   - Workflow name field.
6. Graph:
   - Default link wait grouped control: no wait, fixed duration, random min/max.
   - Help text explaining the setting affects new links only.
7. Run Policy:
   - Maximum duration.
   - Browser retention.
   - Allow Run JavaScript.
   - Run from selected toggle and scope select.
   - Batch defaults visible but disabled with paused note.
8. Browser Launch:
   - Browser identity summary: identity id, display name, fingerprint seed,
     persona metadata.
   - Reuse login session switch.
   - Proxy settings group.
   - Timezone/locale/GeoIP group.
   - WebRTC and fonts group.
   - Humanize input group.
   - Headless/headed policy group.
   - Reset Identity destructive action with explanation.
9. Environment:
   - Initial variables as typed rows with add/remove controls.
   - Row/JSON mode where supported.
10. Help:
   - English/Vietnamese segmented language toggle.
   - Nested collapsible help sections.
   - Field details close to corresponding fields or in a stable help panel.
11. Footer:
   - Save Settings primary.
   - Cancel/Close secondary.
   - Unsaved-close flow: Save and close, Discard changes, Keep editing.

COMPACT DESKTOP:
- Section navigation becomes horizontal tabs.
- Help collapses into drawer.
- Footer stays visible.
- Body scrolls internally.

ACCEPTANCE CRITERIA:
- Settings are grouped by operator decision.
- Risky browser identity controls are visually separated.
- Save/dirty/validation states are always visible.
