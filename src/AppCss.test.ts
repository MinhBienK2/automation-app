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
    const actionMenu = cssRule(".action-picker-menu");
    const actionGroupLabel = cssRule(".action-picker-group-label");
    const actionOption = cssRule(".action-picker-option");
    const monitorStepStatus = cssRule(".monitor-step-status");
    const pageBackButton = cssRule(".page-back-button");
    const stepList = cssRule(".step-list");
    const stepDetailPanel = cssRule(".step-detail-panel");
    const stepItem = cssRule(".step-item");
    const stepDragHandle = cssRule(".step-drag-handle");
    const builderTitle = cssRule(".builder-steps-title");

    expect(actionMenu).toContain("max-height: min(360px, calc(100dvh - 220px))");
    expect(actionMenu).toContain("overflow-y: auto");
    expect(actionGroupLabel).toContain("color: #3ecf8e");
    expect(actionGroupLabel).toContain("border-bottom: 1px solid #2e2e2e");
    expect(actionOption).toContain("color: #b4b4b4");
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
    expect(dialogSource).toContain('aria-label="Close dialog"');
    expect(dialogSource).not.toContain("bg-white");
  });
});
