---
name: Mission Control Automation System
colors:
  background: "#0B1016"
  panel: "#0E151D"
  surface: "#121C26"
  elevated-surface: "#172431"
  border: "#233240"
  border-emphasis: "#314758"
  text-primary: "#E7EEF5"
  text-secondary: "#9AAEBD"
  text-muted: "#667D8D"
  primary: "#32D3E6"
  primary-wash: "rgba(50, 211, 230, 0.12)"
  success: "#39D98A"
  warning: "#F4B740"
  danger: "#F06467"
typography:
  page-title:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: "600"
    lineHeight: 38px
    letterSpacing: "0"
  section-title:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: "500"
    lineHeight: 26px
    letterSpacing: "0"
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
    letterSpacing: "0"
  control:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "500"
    lineHeight: 18px
    letterSpacing: "0"
  technical:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: "0.08em"
  metric:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: "600"
    lineHeight: 40px
    letterSpacing: "0"
rounded:
  control: 8px
  card: 12px
  panel: 16px
  pill: 9999px
spacing:
  base: 8px
  compact: 12px
  panel: 16px
  page: 24px
  section: 32px
---

# Mission Control Automation System

## Brand And Style

Mission Control is a desktop operations workspace for authorized browser
automation labs. It should feel precise, real-time, and durable enough for long
operator sessions. The design prioritizes scannable live execution, graph
authoring, evidence traceability, schedules, and browser identity posture.

Use a dark command-center canvas with restrained cyan control accents. Avoid a
marketing layout, oversized decorative hero sections, gradients, illustration
cards, and one-note blue/slate styling. The first screen is an operations board.

## Color Roles

- Background `#0B1016`: main desktop canvas.
- Panel `#0E151D`: sidebar and inset workspace regions.
- Surface `#121C26`: cards, tables, graph panels, and list rows.
- Elevated surface `#172431`: selected details, drawers, dialogs, and overlays.
- Border `#233240`: normal card and control boundaries.
- Emphasized border `#314758`: hover, active, and high-separation boundaries.
- Primary text `#E7EEF5`: headings and core content.
- Secondary text `#9AAEBD`: descriptions, row metadata, and labels.
- Muted text `#667D8D`: disabled or low-priority metadata only.
- Cyan `#32D3E6`: active execution, selection, focus, and primary actions.
- Green `#39D98A`: completed successful execution only.
- Amber `#F4B740`: validation, attention, paused, skipped, or challenge states.
- Red `#F06467`: runtime failure, blocking errors, stop, delete, and reset.

Color must never be the only state indicator. Status uses readable labels and
icons with the semantic color.

## Typography

Use Inter for primary interface text. Use Geist Mono or a close monospace for
run IDs, timestamps, policy tags, browser identity metadata, evidence paths,
node IDs, and compact technical labels.

Page titles are 28-32px, medium weight. Section titles are 18-20px. Standard
body and controls are 13-14px. Technical labels are 11-12px uppercase with
expanded tracking. Metrics can reach 28-36px, but only in KPI cards.

Do not scale text with viewport width. Keep letter spacing at zero except for
uppercase technical labels.

## Shape And Spacing

Use a 4px and 8px rhythm. Controls use 8px radius. Cards and data panels use
12px radius. Large panels, drawers, and dialogs use 16px radius. Status chips
and compact filters use full pills.

Depth is created through tonal layers and borders. Reserve soft shadows for
dialogs, menus, and drawers only.

## Shell

The baseline frame is 1440 x 1024. Use a 232px left sidebar with product mark,
navigation, environment state, diagnostics, and operator area. The main region
has a compact command bar with page context, command/search, environment badge,
alerts, and page-specific primary action.

The compact desktop frame is 1024 x 768. Collapse the sidebar to an icon rail,
hide secondary table metadata before primary content, reduce dashboard grids to
two columns or prioritized stacks, and use drawers for Graph Builder inspector
and palette when space is constrained.

## Components

- Primary button: cyan fill with dark text, reserved for create, launch, and
  save actions.
- Secondary button: dark surface with emphasized border for configure,
  validate, import, export, and duplicate.
- Danger button: red-tinted fill or border for stop, delete, archive, and reset.
- Status chip: compact pill with icon and readable label.
- Metric card: large value, concise label, and optional semantic trend marker.
- Data table: sticky header when useful, subtle row hover, cyan selected-row
  wash, and left selection indicator.
- Side inspector: tabbed panel with collapsible sections and technical fields.
- Node card: action header, concise configuration summary, visible ports, and
  semantic run state.
- Timeline item: dot, connector, timestamp, summary, duration, and artifact or
  failure marker.
- Alert item: severity, short message, related workflow/run, and next action.
- Form control: dark surface, explicit border, visible cyan focus, and readable
  red error text.
- Dialog: focused consequential workflows and confirmations.
- Drawer: fast details or configuration that preserves page context.

## Interaction Rules

Running state uses cyan and at most a restrained pulse on a dot or indicator.
Entire panels do not animate. Success green appears only for finished success.
Validation uses amber. Blocking runtime failure uses red. Destructive actions
require confirmation and state the affected scope. Evidence items retain
traceability to workflow, run, step, and identity.

Every icon-only control has an accessible label and hover/focus help. Keyboard
navigation and visible focus apply to navigation, data rows, graph controls,
drawers, and dialogs.
