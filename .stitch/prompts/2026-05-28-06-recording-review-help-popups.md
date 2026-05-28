---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Recording Review And Help Popups"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign all graph-adjacent popups as a coherent popup system: Recording
Review, Add Step palette, Action Help, Step Help, Shortcuts, and small
confirmation dialogs. Use the applied Mission Control design system and one
shared modal anatomy.

PLATFORM: Desktop web app dialog and popover states.

POPUP SYSTEM:
1. Shared anatomy:
   - Header with eyebrow/title/description and close icon.
   - Scrollable body when content is long.
   - Sticky footer when actions are present.
   - Primary, secondary, and destructive actions clearly separated.
2. Recording Review:
   - Large modal showing session mode: Save Workflow or Replace Graph.
   - Session summary: workflow name, draft mode, step count, warning count,
     captured time range.
   - Review step list with include checkbox, step number, action label, target
     summary, captured value summary, warning pill, and edit affordance.
   - Excluded steps are muted but readable.
   - Secret or masked values show warning and safe masked text.
   - Footer actions: Save Workflow / Replace Graph primary, Stop/Generate Draft
     where relevant, Discard secondary/destructive depending state.
3. Add Action/Add Logic palette:
   - Left category list.
   - Right searchable result grid/list.
   - Compact scrollable categories.
   - Results show label, short operator intent, and action family.
   - Hover/selected state is clear.
   - Empty search state.
4. Action Help / Step Help:
   - Header with action or graph-node name, type, language toggle, close.
   - Scrollable content with collapsible sections.
   - Required fields, optional fields, advanced fields, outputs, examples,
     safety notes, and common mistakes as structured disclosure groups.
   - Long examples and technical details in contained monospace blocks.
5. Shortcuts:
   - Groups for navigation, selection, editing, run/save.
   - Keyboard tokens and compact descriptions.

COMPACT DESKTOP:
- Large dialogs clamp to viewport.
- Shortcut groups become one column.
- Long step lists scroll internally.

ACCEPTANCE CRITERIA:
- Recording Review no longer visually diverges from Mission Control.
- Palettes remain usable with many action types.
- Help popups are structured enough for operators to scan.
