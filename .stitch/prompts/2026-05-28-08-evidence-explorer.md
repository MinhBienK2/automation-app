---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Evidence Explorer"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign Evidence Explorer as a durable investigation workspace for typed run
evidence. Use current behavior: list evidence, search/filter by type, select
evidence, preview screenshots through safe preview data, reveal artifacts,
export selection, and navigate to related workflow/run/identity.

PLATFORM: Desktop web app screen.

PAGE STRUCTURE:
1. Header:
   - Eyebrow "Evidence Workspace".
   - Page title "Evidence Explorer".
   - Last refreshed timestamp.
   - Actions: Refresh and Export Selection.
2. Filter toolbar:
   - Search input.
   - Type select.
   - View segmented control: List/Grid.
   - Selection count chip when items are selected.
3. Workspace:
   - Left/main results panel.
   - Right detail panel.
4. Results:
   - List mode: dense rows with checkbox, evidence label, type/status/source,
     workflow, identity, timestamp, selected state.
   - Grid mode: compact artifact cards, especially for screenshots, while
     staying data-dense and readable.
5. Detail panel:
   - Evidence title/type/status.
   - Screenshot preview area when available.
   - Metadata definition list: workflow, run, identity, step, artifact kind,
     created time, safe relative label.
   - Actions: Preview Screenshot, Reveal Artifact, Open Run, Open Workflow,
     Open Identity.
6. Warnings and results:
   - Malformed/skipped data warning as contained warning.
   - Detail load error as contained state.
   - Export success status with safe bundle label.

COMPACT DESKTOP:
- Detail panel stacks below results or becomes drawer.
- Toolbar wraps into two rows.
- Grid becomes one or two columns.

ACCEPTANCE CRITERIA:
- Evidence list and detail feel investigative and traceable.
- Screenshot preview is bounded and does not distort layout.
- Bulk selection/export state is clear.
