import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const appCss = readFileSync(join(process.cwd(), "src/App.css"), "utf8");
const buttonSource = readFileSync(
  join(process.cwd(), "src/components/ui/button.tsx"),
  "utf8",
);
const dialogSource = readFileSync(
  join(process.cwd(), "src/components/ui/dialog.tsx"),
  "utf8",
);
const cssFiles = [
  "src/App.css",
  "src/styles/base.css",
  "src/styles/layout.css",
  "src/styles/workflows.css",
  "src/styles/workflow-graph.css",
  "src/styles/modals.css",
  "src/styles/responsive.css",
];
const css = cssFiles
  .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
  .join("\n");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("App CSS", () => {
  test("uses App.css as a small style entrypoint", () => {
    expect(appCss).toContain('@import "./styles/base.css";');
    expect(appCss).toContain('@import "./styles/layout.css";');
    expect(appCss).toContain('@import "./styles/workflows.css";');
    expect(appCss).toContain('@import "./styles/workflow-graph.css";');
    expect(appCss).toContain('@import "./styles/modals.css";');
    expect(appCss).not.toContain('@import "./styles/monitor.css";');
    expect(appCss).toContain('@import "./styles/responsive.css";');
    expect(appCss.split("\n").length).toBeLessThanOrEqual(12);
  });

  test("keeps step help modal content scrollable on small screens", () => {
    const dialog = cssRule(".step-help-dialog");
    const body = cssRule(".step-help-body");

    expect(dialog).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(dialog).toContain("height: min(760px, calc(100dvh - 48px))");
    expect(body).toContain("overflow-y: auto");
  });

  test("removes legacy backdrop CSS after Radix dialog migration", () => {
    expect(css).not.toContain(".modal-backdrop");
    expect(css).not.toContain(".monitor-backdrop");
  });

  test("removes legacy button class CSS after shared Button migration", () => {
    expect(css).not.toContain(".primary-button {");
    expect(css).not.toContain(".ghost-button {");
    expect(css).not.toContain(".secondary-danger {");
  });

  test("exposes design tokens for shared UI primitives", () => {
    const root = cssRule(":root");

    expect(root).toContain("--app-bg: #171717");
    expect(root).toContain("--app-surface: #0f0f0f");
    expect(root).toContain("--app-accent: #3ecf8e");
    expect(root).toContain("--app-radius-pill: 9999px");
    expect(buttonSource).toContain("var(--app-accent-border)");
    expect(buttonSource).not.toContain("#3ecf8e");
  });

  test("does not scale font sizes with viewport units", () => {
    expect(css).not.toMatch(/font-size\s*:\s*[^;]*(vw|vh|vmin|vmax)/);
  });

  test("keeps workflow detail overlays and compact controls contained", () => {
    const addStepPalette = cssRule(".add-step-palette");
    const paletteBody = cssRule(".add-step-palette-body");
    const actionCategory = cssRule(".action-category");
    const actionCategoryActive = cssRule(".action-category-active,\n.action-category:hover");
    const actionResultList = cssRule(".action-result-list");
    const actionResult = cssRule(".action-result");
    const pageBackButton = cssRule(".page-back-button");
    const toastAlert = cssRule(".toast-alert");

    expect(addStepPalette).toContain("width: min(760px, calc(100vw - 48px))");
    expect(addStepPalette).toContain("max-height: min(760px, calc(100dvh - 48px))");
    expect(paletteBody).toContain("grid-template-columns: 160px minmax(0, 1fr)");
    expect(actionCategory).toContain("color: #b4b4b4");
    expect(actionCategoryActive).toContain("color: #3ecf8e");
    expect(actionResultList).toContain("overflow-y: auto");
    expect(css).toContain(".action-result-list {\n  grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(actionResult).toContain("min-height: 58px");
    expect(css).not.toContain(".action-picker-menu");
    expect(css).not.toContain(".monitor-dialog");
    expect(css).not.toContain(".monitor-step-status");
    expect(css).not.toContain(".browser-config-dialog");
    expect(css).not.toContain(".browser-config-toggle");
    expect(css).not.toContain(".builder-grid");
    expect(css).not.toContain(".step-list");
    expect(css).not.toContain(".step-detail-panel");
    expect(pageBackButton).toContain("border: 1px solid #2e2e2e");
    expect(toastAlert).toContain("position: fixed");
    expect(toastAlert).toContain("z-index: 70");
    expect(toastAlert).toContain("bottom: 24px");
    expect(dialogSource).toContain('aria-label="Close dialog"');
    expect(dialogSource).not.toContain("bg-white");
  });

  test("lets the workflow detail graph workspace fill the content column", () => {
    const detailScreen = cssRule(".workflow-detail-screen");
    const graphCanvas = cssRule(".graph-canvas");
    const graphFlow = cssRule(".graph-canvas .react-flow");

    expect(detailScreen).toContain("width: 100%");
    expect(detailScreen).toContain("max-width: none");
    expect(graphCanvas).toContain("height: clamp(460px, calc(100dvh - 260px), 640px)");
    expect(graphFlow).toContain("height: 100%");
  });

  test("keeps run error surfaces dense and text-contained", () => {
    const runActions = cssRule(".page-detail-header .run-actions");
    const issueSummary = cssRule(".run-issue-summary-text");
    const issueDetails = cssRule(".run-issue-details");
    const inspector = cssRule(".graph-inspector");
    const graphErrorDetails = cssRule(".graph-error-details");

    expect(runActions).toContain("display: flex");
    expect(runActions).toContain("width: auto");
    expect(issueSummary).toContain("overflow-wrap: anywhere");
    expect(issueDetails).toContain("white-space: pre-wrap");
    expect(issueDetails).toContain("max-height:");
    expect(inspector).toContain("min-width: 0");
    expect(graphErrorDetails).toContain("overflow-wrap: anywhere");
    expect(graphErrorDetails).toContain("white-space: pre-wrap");
  });

  test("keeps React Flow edges and connection previews visible while dragging ports", () => {
    const graphNode = cssRule(".graph-node");
    const graphHandle = cssRule(".graph-handle");
    const connectionLine = cssRule(".graph-canvas .react-flow__connectionline");
    const connectionPath = cssRule(".graph-canvas .react-flow__connection-path");
    const edgePath = cssRule(".graph-canvas .react-flow__edge-path");
    const edgeLabel = cssRule(".graph-canvas .react-flow__edge-text");
    const edgeLabelBackground = cssRule(".graph-canvas .react-flow__edge-textbg");
    const activeSourceHandle = cssRule(".graph-canvas .react-flow__handle.connectingfrom");
    const validTargetHandle = cssRule(".graph-canvas .react-flow__handle.connectingto.valid");

    expect(graphNode).toContain("width: 160px");
    expect(graphNode).toContain("min-height: 64px");
    expect(graphHandle).toContain("pointer-events: all");
    expect(graphHandle).toContain("cursor: crosshair");
    expect(css).not.toContain(".graph-edge-overlay");
    expect(css).not.toContain(".graph-visible-edge");
    expect(css).not.toContain(".graph-connection-preview");
    expect(connectionLine).toContain("z-index: 40");
    expect(connectionLine).toContain("overflow: visible");
    expect(connectionPath).toContain("stroke: #3ecf8e");
    expect(connectionPath).toContain("stroke-width: 3");
    expect(connectionPath).toContain("stroke-linecap: round");
    expect(edgePath).toContain("stroke: #4d4d4d");
    expect(edgePath).toContain("stroke-width: 2.5");
    expect(edgeLabel).toContain("fill: #b4b4b4");
    expect(edgeLabelBackground).toContain("fill: #0f0f0f");
    expect(activeSourceHandle).toContain("background: #fafafa");
    expect(validTargetHandle).toContain("background: #00c573");
  });

  test("keeps graph port tooltips delayed and above neighboring nodes", () => {
    const tooltipBubble = cssRule(".graph-handle::after");
    const visibleTooltip = cssRule(
      ".graph-handle:hover::after,\n.graph-handle:focus-visible::after",
    );
    const activeNode = cssRule(
      ".graph-canvas .react-flow__node:has(.graph-handle:hover),\n.graph-canvas .react-flow__node:has(.graph-handle:focus-visible)",
    );

    expect(tooltipBubble).toContain("transition-delay: 0ms");
    expect(visibleTooltip).toContain("transition-delay: 1s");
    expect(activeNode).toContain("z-index: 1000 !important");
  });

  test("keeps graph error colors dominant when issue or failed items are selected", () => {
    const selectedNode = cssRule(".graph-node-selected");
    const selectedIssueNode = cssRule(".graph-node-has-issue.graph-node-selected");
    const selectedFailedNode = cssRule(".graph-node-failed.graph-node-selected");
    const selectedIssueEdge = cssRule(
      ".graph-canvas .graph-edge-has-issue.graph-edge-selected .react-flow__edge-path",
    );
    const selectedFailedEdge = cssRule(
      ".graph-canvas .graph-edge-failed.graph-edge-selected .react-flow__edge-path",
    );

    expect(selectedNode).not.toContain("border-color: rgba(34, 211, 238");
    expect(selectedNode).toContain("outline: 2px solid rgba(34, 211, 238");
    expect(selectedIssueNode).toContain("border-color: rgba(251, 191, 36");
    expect(selectedFailedNode).toContain("border-color: rgba(248, 113, 113");
    expect(selectedIssueEdge).toContain("stroke: #fbbf24");
    expect(selectedFailedEdge).toContain("stroke: #ff7b72");
  });

  test("keeps variable rows tabular while protecting narrow inspectors from overflow", () => {
    const variableTable = cssRule(".variable-row-table");
    const variableGrid = cssRule(".variable-row-grid");
    const settingsVariableTable = cssRule(".settings-field-group-grid > .variable-row-table");

    expect(variableTable).toContain("overflow-x: auto");
    expect(variableGrid).toContain("grid-template-columns: minmax(96px, 1fr) 116px minmax(120px, 1.4fr) auto");
    expect(variableGrid).toContain("min-width: 520px");
    expect(settingsVariableTable).toContain("grid-column: 1 / -1");
  });

  test("groups related workflow settings fields without changing the dark theme", () => {
    const fieldGroup = cssRule(".settings-field-group");
    const fieldGroupHeader = cssRule(".settings-field-group-header");
    const fieldGroupGrid = cssRule(".settings-field-group-grid");
    const fieldGroupFooter = cssRule(".settings-field-group-footer");

    expect(fieldGroup).toContain("border: 1px solid #2e2e2e");
    expect(fieldGroup).toContain("border-radius: 8px");
    expect(fieldGroup).toContain("background: #0f0f0f");
    expect(fieldGroupHeader).toContain("border-bottom: 1px solid #242424");
    expect(fieldGroupGrid).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(fieldGroupFooter).toContain("color: #898989");
    expect(cssRule(".settings-field-group-wide")).toContain("grid-column: 1 / -1");
    expect(cssRule(".settings-field-group-actions")).toContain("flex-wrap: wrap");
  });
});
