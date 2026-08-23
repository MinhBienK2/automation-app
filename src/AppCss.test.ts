import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const readCss = (path: string) => readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
const appCss = readCss("src/App.css");
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
  "src/styles/workflow-panels.css",
  "src/styles/mission-workspaces.css",
  "src/styles/workflow-graph.css",
  "src/styles/workflow-graph-overlays.css",
  "src/styles/modals.css",
  "src/styles/responsive.css",
];
const css = cssFiles.map(readCss).join("\n");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("App CSS", () => {
  test("uses App.css as a small style entrypoint", () => {
    expect(appCss).toContain('@import "./styles/base.css";');
    expect(appCss).toContain('@import "./styles/layout.css";');
    expect(appCss).toContain('@import "./styles/workflows.css";');
    expect(appCss).toContain('@import "./styles/workflow-panels.css";');
    expect(appCss).toContain('@import "./styles/mission-workspaces.css";');
    expect(appCss).toContain('@import "./styles/workflow-graph.css";');
    expect(appCss).toContain('@import "./styles/workflow-graph-overlays.css";');
    expect(appCss).toContain('@import "./styles/modals.css";');
    expect(appCss).not.toContain('@import "./styles/monitor.css";');
    expect(appCss).toContain('@import "./styles/responsive.css";');
    expect(appCss).toContain('@import "./styles/mission-control.css";');
    // App.css now also activates daisyUI via @plugin blocks (custom themes).
    // The entrypoint stays a thin import + plugin shim — all real CSS lives in stylesheets.
    expect(appCss.split("\n").length).toBeLessThanOrEqual(100);
  });

  test("keeps step help modal content scrollable on small screens", () => {
    const dialog = cssRule(".step-help-dialog");
    const body = cssRule(".step-help-body");

    expect(dialog).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(dialog).toContain("height: min(760px, calc(100dvh - 48px))");
    expect(body).toContain("overflow-y: auto");
  });

  test("styles help disclosures as readable nested sections", () => {
    const helpDisclosure = cssRule(".help-disclosure");
    const helpSummary = cssRule(".help-disclosure-summary");
    const fieldGroupSummary = cssRule(".help-field-group-summary");
    const fieldLeaf = cssRule(".help-field-leaf");
    const optionDisclosure = cssRule(".help-option-disclosure");
    const settingsDisclosure = cssRule(".workflow-settings-help-disclosure");
    const settingsItem = cssRule(".workflow-settings-help-item");

    expect(helpDisclosure).toContain("border: 1px solid var(--border)");
    expect(helpSummary).toContain("cursor: pointer");
    expect(helpSummary).toContain("list-style: none");
    expect(fieldGroupSummary).toContain("cursor: pointer");
    expect(fieldLeaf).toContain("border-top: 1px solid var(--border)");
    expect(optionDisclosure).toContain("border: 1px solid var(--border)");
    expect(settingsDisclosure).toContain("background: var(--surface)");
    expect(settingsItem).toContain("border: 1px solid var(--border)");
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

  test("removes the shell command search header styles", () => {
    expect(css).not.toContain(".shell-command-bar");
    expect(css).not.toContain(".command-search");
    expect(css).not.toContain(".shell-alert-button");
  });

  test("exposes design tokens for shared UI primitives", () => {
    const root = cssRule(":root");

    // Source design tokens (dark theme defaults)
    expect(root).toContain("--bg: #0b1016");
    expect(root).toContain("--surface: #121c26");
    expect(root).toContain("--accent: #32d3e6");
    // Legacy --app-* aliases reference the theming tokens (not hardcoded)
    expect(root).toContain("--app-bg: var(--bg)");
    expect(root).toContain("--app-accent: var(--accent)");
    expect(root).toContain("--app-radius-pill: var(--radius-lg)");
    // Theme/accent/density switch blocks drive the token overrides (kept after
    // the daisyUI migration). daisyUI primary/accent colors are sourced from
    // these same tokens via App.css custom themes.
    expect(css).toContain('html[data-theme="light"]');
    expect(css).toContain('html[data-accent="teal"]');
    expect(css).toContain('html[data-density="compact"]');
    // Button is now a daisyUI wrapper; it should not embed hardcoded accents.
    expect(buttonSource).not.toContain("#32d3e6");
  });

  test("does not scale font sizes with viewport units", () => {
    expect(css).not.toMatch(/font-size\s*:\s*[^;]*(vw|vh|vmin|vmax)/);
  });

  test("keeps workflow detail overlays and compact controls contained", () => {
    const addStepPalette = cssRule(".add-step-palette");
    const paletteBody = cssRule(".add-step-palette-body");
    const actionCategory = cssRule(".action-category");
    const actionCategoryActive = cssRule(".action-category-active");
    const actionResultList = cssRule(".action-result-list");
    const actionResult = cssRule(".action-result");
    const pageBackButton = cssRule(".page-back-button");
    const toastAlert = cssRule(".toast-alert");

    expect(addStepPalette).toContain("width: min(980px, calc(100vw - 48px))");
    expect(addStepPalette).toContain("max-height: min(840px, calc(100dvh - 48px))");
    expect(paletteBody).toContain("grid-template-columns: 200px minmax(0, 1fr)");
    expect(actionCategory).toContain("color: var(--fg-secondary)");
    expect(actionCategoryActive).toContain("color: var(--accent)");
    expect(actionResultList).toContain("overflow-y: auto");
    expect(css).toContain(".action-result-list {\n  grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(actionResult).toContain("min-height: 72px");
    expect(css).not.toContain(".action-picker-menu");
    expect(css).not.toContain(".monitor-dialog");
    expect(css).not.toContain(".monitor-step-status");
    expect(css).not.toContain(".browser-config-dialog");
    expect(css).not.toContain(".browser-config-toggle");
    expect(css).not.toContain(".builder-grid");
    expect(css).not.toContain(".step-list");
    expect(css).not.toContain(".step-detail-panel");
    expect(pageBackButton).toContain("border: 1px solid var(--border)");
    expect(toastAlert).toContain("position: fixed");
    expect(toastAlert).toContain("z-index: 70");
    expect(toastAlert).toContain("bottom: 24px");
    // Dialog still exposes the same accessible close affordance for screen readers
    // regardless of whether it is backed by Radix or daisyUI modal.
    expect(dialogSource).toContain('aria-label="Close dialog"');
    expect(dialogSource).not.toContain("bg-white");
  });

  test("keeps graph node category colors readable without left rail decoration", () => {
    const actionNode = cssRule(".graph-node-action");
    const logicNode = cssRule(".graph-node-logic");
    const subflowNode = cssRule(".graph-node-subflow");
    const variableNode = cssRule(".graph-node-variable");

    expect(css).not.toContain(".graph-node::before");
    expect(css).not.toContain(".graph-node-subflow::before");
    expect(actionNode).toContain("--graph-node-accent: var(--accent)");
    expect(logicNode).toContain("--graph-node-accent: var(--attention)");
    expect(subflowNode).toContain("--graph-node-accent: var(--color-orange)");
    expect(variableNode).toContain("--graph-node-accent: var(--color-purple)");
    expect(subflowNode).not.toContain("--graph-node-accent: var(--accent)");
    expect(subflowNode).not.toContain("--graph-node-accent: var(--attention)");
  });

  test("lets the workflow detail graph workspace fill the content column", () => {
    const detailScreen = cssRule(".workflow-detail-screen");
    const graphLayout = cssRule(".workflow-graph-layout");
    const graphCanvas = cssRule(".graph-canvas");
    const graphFlow = cssRule(".graph-canvas .react-flow");
    const inspectorDrawer = cssRule(".graph-inspector-drawer");

    expect(detailScreen).toContain("width: 100%");
    expect(detailScreen).toContain("max-width: none");
    expect(graphLayout).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(graphLayout).toContain("position: relative");
    expect(graphCanvas).toContain("height: clamp(460px, calc(100dvh - 180px), 85vh)");
    expect(graphFlow).toContain("height: 100%");
    expect(inspectorDrawer).toContain("position: absolute");
    expect(inspectorDrawer).toContain("right: 0");
    expect(inspectorDrawer).toContain("animation: graph-inspector-slide-in");
  });

  test("lets the Projects workspace fill the content column without a nested right header", () => {
    const projectsScreen = cssRule(".projects-screen");
    const projectsWorkspace = cssRule(".projects-workspace");
    const projectsDetailPanel = cssRule(".projects-detail-panel");
    const projectCollectionPanel = cssRule(".project-collection-panel");
    const nestedCollectionScreen = cssRule(".project-collection-panel > .app-screen");

    expect(projectsScreen).toContain("width: 100%");
    expect(projectsScreen).toContain("max-width: none");
    expect(projectsScreen).toContain("padding-inline: 16px");
    expect(projectsWorkspace).toContain(
      "grid-template-columns: minmax(240px, 300px) minmax(0, 1fr)",
    );
    expect(projectsDetailPanel).toContain("width: 100%");
    expect(projectCollectionPanel).toContain("width: 100%");
    expect(nestedCollectionScreen).toContain("max-width: none");
    expect(css).not.toContain(".projects-detail-header");
  });

  test("lets Project Settings fill the detail column with inline project-name save", () => {
    const projectSettingsPanel = cssRule(".settings-project-environments-panel");
    const projectNameControl = cssRule(".project-name-control");

    expect(projectSettingsPanel).toContain("width: 100%");
    expect(projectSettingsPanel).toContain("max-width: none");
    expect(projectNameControl).toContain("display: flex");
    expect(projectNameControl).toContain("flex-direction: column");
    expect(projectNameControl).toContain("gap: 6px");
  });

  test("uses a daisyUI error treatment for destructive buttons", () => {
    // Button wrapper maps destructive -> daisyUI btn-error; legacy custom CSS
    // var based destructive styling is gone.
    expect(buttonSource).toContain("btn-error");
    expect(buttonSource).not.toContain("var(--app-danger)");
  });

  test("keeps Projects sidebar and collection content as independent scroll regions", () => {
    const projectsScreen = cssRule(".projects-screen");
    const projectsWorkspace = cssRule(".projects-workspace");
    const projectsListPanel = cssRule(".projects-list-panel");
    const projectsListScroll = cssRule(".projects-list-scroll");
    const projectsDetailPanel = cssRule(".projects-detail-panel");

    expect(projectsScreen).toContain("height: 100vh");
    expect(projectsScreen).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(projectsScreen).toContain("overflow: hidden");
    expect(projectsWorkspace).toContain("min-height: 0");
    expect(projectsWorkspace).toContain("overflow: hidden");
    expect(projectsListPanel).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(projectsListPanel).toContain("min-height: 0");
    expect(projectsListPanel).toContain("overflow: hidden");
    expect(projectsListScroll).toContain("min-height: 0");
    expect(projectsListScroll).toContain("overflow-y: auto");
    expect(projectsDetailPanel).toContain("min-height: 0");
    expect(projectsDetailPanel).toContain("overflow-y: auto");
  });

  test("styles project collection tabs as fixed detail navigation", () => {
    const projectCollectionTabs = cssRule(".project-collection-tabs");
    const projectCollectionItem = cssRule(".project-collection-item");
    const projectCollectionItemActive = cssRule('.project-collection-item[data-active="true"]');
    const projectCollectionItemActiveRail = cssRule(
      '.project-collection-item[data-active="true"]::before',
    );
    const projectCollectionItemHover = cssRule(
      '.project-collection-item:hover:not([data-active="true"])',
    );
    const projectCollectionItemFocus = cssRule(".project-collection-item:focus-visible");

    expect(projectCollectionTabs).toContain("position: sticky");
    expect(projectCollectionTabs).toContain("display: flex");
    expect(projectCollectionTabs).toContain("background: var(--sidebar-bg)");
    expect(projectCollectionItem).toContain("position: relative");
    expect(projectCollectionItem).toContain("border-radius: 8px");
    expect(projectCollectionItem).toContain("overflow: hidden");
    expect(projectCollectionItem).toContain("white-space: nowrap");
    expect(projectCollectionItemActive).toContain("background: linear-gradient");
    expect(projectCollectionItemActive).toContain("color: var(--fg-primary)");
    expect(projectCollectionItemActiveRail).toContain("background: var(--accent)");
    expect(projectCollectionItemHover).toContain("background: var(--surface-elevated)");
    expect(projectCollectionItemFocus).toContain("box-shadow: 0 0 0 2px var(--focus-ring)");
  });

  test("keeps workflow detail command actions on one desktop row", () => {
    const runActions = cssRule(".page-detail-header .run-actions");

    expect(runActions).toContain("display: flex");
    expect(runActions).toContain("flex-wrap: nowrap");
    expect(runActions).toContain("max-width: none");
  });

  test("keeps the run monitor drawer below workflow run controls", () => {
    const drawer = cssRule(".run-monitor-drawer");

    expect(drawer).toContain("top: 16px");
  });

  test("keeps run error surfaces dense and text-contained", () => {
    const runActions = cssRule(".page-detail-header .run-actions");
    const runStatusParagraph = cssRule(".run-status p");
    const runtimeIssuePanel = cssRule(".run-issue-panel-runtime");
    const systemIssuePanel = cssRule(".run-issue-panel-system");
    const blockingIssuePanel = cssRule(".run-issue-panel-blocking");
    const issueSummary = cssRule(".run-issue-summary-text");
    const issueDetails = cssRule(".run-issue-details");
    const inspector = cssRule(".graph-inspector");
    const graphErrorDetails = cssRule(".graph-error-details");

    expect(runActions).toContain("display: flex");
    expect(runActions).toContain("width: auto");
    expect(runStatusParagraph).toBe("");
    expect(runtimeIssuePanel).toContain("border-color: rgba(240, 100, 103, 0.48)");
    expect(systemIssuePanel).toContain("border-color: rgba(240, 100, 103, 0.48)");
    expect(blockingIssuePanel).toContain("border-color: rgba(244, 183, 64, 0.4)");
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
    expect(graphNode).toContain("min-height: 82px");
    expect(graphHandle).toContain("pointer-events: all");
    expect(graphHandle).toContain("cursor: crosshair");
    expect(css).not.toContain(".graph-edge-overlay");
    expect(css).not.toContain(".graph-visible-edge");
    expect(css).not.toContain(".graph-connection-preview");
    expect(connectionLine).toContain("z-index: 40");
    expect(connectionLine).toContain("overflow: visible");
    expect(connectionPath).toContain("stroke: var(--accent)");
    expect(connectionPath).toContain("stroke-width: 3");
    expect(connectionPath).toContain("stroke-linecap: round");
    expect(edgePath).toContain("stroke: var(--border-hover)");
    expect(edgePath).toContain("stroke-width: 2.5");
    expect(edgeLabel).toContain("fill: var(--fg-secondary)");
    expect(edgeLabelBackground).toContain("fill: var(--surface)");
    expect(activeSourceHandle).toContain("background: var(--fg-primary)");
    expect(validTargetHandle).toContain("background: var(--success)");
  });

  test("keeps workflow edge kind styling subordinate to semantic state colors", () => {
    const mainEdge = cssRule(".graph-canvas .graph-edge-main .react-flow__edge-path");
    const branchEdge = cssRule(".graph-canvas .graph-edge-branch .react-flow__edge-path");
    const continuationEdge = cssRule(
      ".graph-canvas .graph-edge-continuation .react-flow__edge-path",
    );
    const loopRecoveryEdge = cssRule(
      ".graph-canvas .graph-edge-loop .react-flow__edge-path,\n.graph-canvas .graph-edge-recovery .react-flow__edge-path",
    );
    const completedEdge = cssRule(".graph-canvas .graph-edge-completed .react-flow__edge-path");
    const issueEdge = cssRule(".graph-canvas .graph-edge-has-issue .react-flow__edge-path");
    const failedEdge = cssRule(".graph-canvas .graph-edge-failed .react-flow__edge-path");

    expect(mainEdge).toContain("stroke: var(--border-hover)");
    expect(branchEdge).toContain("stroke-dasharray: 7 5");
    expect(continuationEdge).toContain("stroke-dasharray: 3 4");
    expect(loopRecoveryEdge).toContain("stroke-dasharray: 9 4 2 4");
    expect(branchEdge).not.toContain("var(--success)");
    expect(continuationEdge).not.toContain("var(--success)");
    expect(loopRecoveryEdge).not.toContain("var(--success)");
    expect(css.indexOf(".graph-edge-main")).toBeLessThan(css.indexOf(".graph-edge-completed"));
    expect(completedEdge).toContain("stroke: var(--success)");
    expect(issueEdge).toContain("stroke: var(--attention)");
    expect(failedEdge).toContain("stroke: var(--failure)");
  });

  test("keeps graph node body drags above labels and below ports", () => {
    const graphNodeButton = cssRule(".graph-node-button");
    const graphDragSurface = cssRule(".graph-node-drag-surface");
    const graphHandle = cssRule(".graph-handle");

    expect(graphNodeButton).toContain("z-index: 1");
    expect(graphDragSurface).toContain("z-index: 2");
    expect(graphHandle).toContain("z-index: 3");
  });

  test("wraps long graph node names while keeping compact metadata contained", () => {
    const graphNode = cssRule(".graph-node");
    const graphNodeButton = cssRule(".graph-node-button");
    const graphNodeTitle = cssRule(".graph-node-button > span");
    const graphNodeMeta = cssRule(".graph-node-button small");

    expect(graphNode).toContain("height: 82px");
    expect(graphNodeButton).toContain("height: 100%");
    expect(graphNodeButton).toContain("overflow: hidden");
    expect(graphNodeTitle).toContain("-webkit-line-clamp: 2");
    expect(graphNodeTitle).toContain("white-space: normal");
    expect(graphNodeMeta).toContain("overflow: hidden");
    expect(graphNodeMeta).toContain("text-overflow: ellipsis");
    expect(graphNodeMeta).toContain("white-space: nowrap");
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

    expect(selectedNode).not.toContain("border-color: rgba(50, 211, 230");
    expect(selectedNode).toContain("outline: 2px solid var(--accent-border-strong)");
    expect(selectedIssueNode).toContain("border-color: var(--attention)");
    expect(selectedFailedNode).toContain("border-color: var(--failure)");
    expect(selectedIssueEdge).toContain("stroke: var(--attention)");
    expect(selectedFailedEdge).toContain("stroke: var(--failure)");
  });

  test("makes the actively running graph node visually prominent", () => {
    const runningNode = cssRule(".graph-node-running");

    expect(runningNode).toContain("border-color: var(--accent)");
    expect(runningNode).toContain("background: linear-gradient");
    expect(runningNode).toContain("outline: 3px solid var(--accent-border-strong)");
    expect(runningNode).toContain("box-shadow:");
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

    expect(fieldGroup).toContain("border: 1px solid var(--border)");
    expect(fieldGroup).toContain("border-radius: 8px");
    expect(fieldGroup).toContain("background: var(--surface)");
    expect(fieldGroupHeader).toContain("border-bottom: 1px solid var(--border)");
    expect(fieldGroupGrid).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(fieldGroupFooter).toContain("color: var(--fg-muted)");
    expect(cssRule(".settings-field-group-wide")).toContain("grid-column: 1 / -1");
    expect(cssRule(".settings-field-group-actions")).toContain("flex-wrap: wrap");
  });
});
