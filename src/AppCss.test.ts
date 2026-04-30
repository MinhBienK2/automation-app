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
  "src/styles/modals.css",
  "src/styles/monitor.css",
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
    expect(appCss).toContain('@import "./styles/modals.css";');
    expect(appCss).toContain('@import "./styles/monitor.css";');
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

  test("keeps workflow detail overlays and compact controls contained", () => {
    const addStepPalette = cssRule(".add-step-palette");
    const paletteBody = cssRule(".add-step-palette-body");
    const actionCategory = cssRule(".action-category");
    const actionCategoryActive = cssRule(".action-category-active,\n.action-category:hover");
    const actionResultList = cssRule(".action-result-list");
    const actionResult = cssRule(".action-result");
    const monitorStepStatus = cssRule(".monitor-step-status");
    const pageBackButton = cssRule(".page-back-button");
    const stepList = cssRule(".step-list");
    const stepDetailPanel = cssRule(".step-detail-panel");
    const stepItem = cssRule(".step-item");
    const stepDragHandle = cssRule(".step-drag-handle");
    const builderTitle = cssRule(".builder-steps-title");
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
    expect(monitorStepStatus).toContain("min-width: 74px");
    expect(pageBackButton).toContain("border: 1px solid #2e2e2e");
    expect(stepList).toContain("max-height: min(560px, calc(100dvh - 360px))");
    expect(stepList).toContain("overflow-y: auto");
    expect(stepList).toContain("scrollbar-width: none");
    expect(css).toContain(".step-list::-webkit-scrollbar");
    expect(css).toContain("display: none");
    expect(stepDetailPanel).toContain("position: sticky");
    expect(stepDetailPanel).toContain("top: 20px");
    expect(stepItem).toContain("min-height: 44px");
    expect(stepDragHandle).toContain("min-height: 44px");
    expect(builderTitle).toContain("font-size: 17px");
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

  test("keeps React Flow connection previews visible while dragging ports", () => {
    const graphNode = cssRule(".graph-node");
    const graphHandle = cssRule(".graph-handle");
    const preview = cssRule(".graph-connection-preview");
    const previewPath = cssRule(".graph-connection-preview path");
    const connectionLine = cssRule(".graph-canvas .react-flow__connectionline");
    const connectionPath = cssRule(".graph-canvas .react-flow__connection-path");
    const activeSourceHandle = cssRule(".graph-canvas .react-flow__handle.connectingfrom");
    const validTargetHandle = cssRule(".graph-canvas .react-flow__handle.connectingto.valid");

    expect(graphNode).toContain("width: 160px");
    expect(graphNode).toContain("min-height: 64px");
    expect(graphHandle).toContain("pointer-events: all");
    expect(graphHandle).toContain("cursor: crosshair");
    expect(preview).toContain("z-index: 45");
    expect(preview).toContain("pointer-events: none");
    expect(previewPath).toContain("stroke: #3ecf8e");
    expect(previewPath).toContain("stroke-width: 2.4");
    expect(css).toContain(".graph-connection-preview marker path");
    expect(css).toContain(".graph-edge-overlay #graph-edge-arrow path");
    expect(connectionLine).toContain("z-index: 40");
    expect(connectionLine).toContain("overflow: visible");
    expect(connectionPath).toContain("stroke: #3ecf8e");
    expect(connectionPath).toContain("stroke-width: 3");
    expect(connectionPath).toContain("stroke-linecap: round");
    expect(activeSourceHandle).toContain("background: #fafafa");
    expect(validTargetHandle).toContain("background: #00c573");
  });
});
