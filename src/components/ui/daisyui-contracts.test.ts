import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/*
  Migration contract for the daisyUI 5 migration.
  These tests lock the *new* contract (daisyUI classes, removed deps) so that
  the migration can be driven TDD-style: tests fail (RED) until wrappers are
  rewritten with daisyUI class names.
*/

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("daisyUI migration — removed dependencies", () => {
  test("removes every Radix UI primitive + CVA + clsx + tailwind-merge", () => {
    const deps = packageJson.dependencies ?? {};
    for (const pkg of [
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-slot",
      "@radix-ui/react-tooltip",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ]) {
      expect(deps).not.toHaveProperty(pkg);
    }
  });

  test("keeps daisyUI, tailwind, lucide-react and xyflow", () => {
    const deps = packageJson.dependencies ?? {};
    expect(deps).toHaveProperty("daisyui");
    expect(deps).toHaveProperty("tailwindcss");
    expect(deps).toHaveProperty("lucide-react");
    expect(deps).toHaveProperty("@xyflow/react");
  });

  test("src/lib/utils.ts cn() helper is gone", () => {
    let exists = true;
    try {
      readSrc("src/lib/utils.ts");
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  test("no source file imports cn from @/lib/utils or radix/cva/clsx/twMerge", () => {
    const offenders: string[] = [];
    for (const rel of [
      "src/components/ui/button.tsx",
      "src/components/ui/badge.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/dialog.tsx",
      "src/components/ui/dropdown-menu.tsx",
      "src/components/ui/tooltip.tsx",
      "src/components/ui/scroll-area.tsx",
      "src/components/ui/label.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/textarea.tsx",
      "src/components/ui/switch.tsx",
      "src/components/ui/icon-button.tsx",
      "src/components/ui/segmented-control.tsx",
      "src/components/ui/settings-field-group.tsx",
    ]) {
      const src = readSrc(rel);
      for (const forbidden of [
        "@/lib/utils",
        "@radix-ui",
        "class-variance-authority",
        "clsx",
        "tailwind-merge",
      ]) {
        if (src.includes(forbidden)) offenders.push(`${rel} -> ${forbidden}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("daisyUI migration — App.css activates daisyUI", () => {
  const appCss = readSrc("src/App.css");

  test("enables the daisyUI plugin", () => {
    expect(appCss).toContain('@plugin "daisyui"');
  });

  test("declares the automation-dark and automation-light themes", () => {
    expect(appCss).toContain('name: "automation-dark"');
    expect(appCss).toContain('name: "automation-light"');
  });

  test("wires daisyUI primary to the accent token so accents switch live", () => {
    expect(appCss).toContain("--color-primary: var(--accent)");
    expect(appCss).toContain("--color-base-100: var(--bg)");
    expect(appCss).toContain("--color-base-200: var(--surface)");
  });

  test("still imports every legacy CSS stylesheet", () => {
    for (const sheet of [
      "./styles/base.css",
      "./styles/layout.css",
      "./styles/workflows.css",
      "./styles/workflow-panels.css",
      "./styles/mission-workspaces.css",
      "./styles/schedules.css",
      "./styles/workflow-graph.css",
      "./styles/workflow-graph-overlays.css",
      "./styles/modals.css",
      "./styles/responsive.css",
      "./styles/mission-control.css",
    ]) {
      expect(appCss).toContain(`@import "${sheet}";`);
    }
  });
});

describe("daisyUI migration — CSS conflict classes removed", () => {
  const missionControl = readSrc("src/styles/mission-control.css");

  test("mission-control.css no longer redefines daisyUI component classes", () => {
    // daisyUI owns these now; custom definitions would override/kill the theming.
    for (const forbidden of [
      ".btn {",
      ".btn-primary {",
      ".badge {",
      ".badge-success {",
      ".badge-failure {",
      ".switch {",
      ".slider {",
      ".text-input {",
    ]) {
      expect(missionControl).not.toContain(forbidden);
    }
  });
});

describe("daisyUI migration — UI wrappers use daisyUI class names", () => {
  test("button uses daisyUI btn class names", () => {
    const src = readSrc("src/components/ui/button.tsx");
    expect(src).toContain('"btn');
    expect(src).toContain("btn-ghost");
    expect(src).toContain("btn-error");
    expect(src).not.toContain("var(--app-accent-border)");
    expect(src).not.toContain("console.log");
  });

  test("badge uses daisyUI badge class names", () => {
    const src = readSrc("src/components/ui/badge.tsx");
    expect(src).toContain('"badge');
    expect(src).toContain("badge-success");
    expect(src).toContain("badge-warning");
    expect(src).toContain("badge-error");
  });

  test("card uses daisyUI card class names", () => {
    const src = readSrc("src/components/ui/card.tsx");
    expect(src).toContain('"card');
    expect(src).toContain("card-body");
    expect(src).toContain("card-title");
  });

  test("input/select/textarea use daisyUI class names", () => {
    expect(readSrc("src/components/ui/input.tsx")).toContain('"input');
    expect(readSrc("src/components/ui/select.tsx")).toContain('"select');
    expect(readSrc("src/components/ui/textarea.tsx")).toContain('"textarea');
  });

  test("dialog uses daisyUI modal class names", () => {
    const src = readSrc("src/components/ui/dialog.tsx");
    expect(src).toContain('"modal');
    expect(src).toContain("modal-box");
    expect(src).not.toContain("@radix-ui/react-dialog");
  });

  test("dropdown-menu uses daisyUI dropdown/menu classes", () => {
    const src = readSrc("src/components/ui/dropdown-menu.tsx");
    expect(src).toContain("dropdown");
    expect(src).toContain("menu");
    expect(src).not.toContain("@radix-ui/react-dropdown-menu");
  });

  test("tooltip uses daisyUI tooltip class", () => {
    const src = readSrc("src/components/ui/tooltip.tsx");
    expect(src).toContain('"tooltip');
    expect(src).not.toContain("@radix-ui/react-tooltip");
  });

  test("switch uses daisyUI toggle class", () => {
    const src = readSrc("src/components/ui/switch.tsx");
    expect(src).toContain('"toggle');
    expect(src).not.toContain("--app-accent");
  });

  test("icon-button uses daisyUI tooltip + btn-square", () => {
    const src = readSrc("src/components/ui/icon-button.tsx");
    expect(src).toContain("tooltip");
    expect(src).toContain("btn-square");
  });

  test("segmented-control uses daisyUI join or tabs class", () => {
    const src = readSrc("src/components/ui/segmented-control.tsx");
    expect(src.includes("join") || src.includes("tabs")).toBe(true);
  });

  test("settings-field-group uses daisyUI fieldset class", () => {
    const src = readSrc("src/components/ui/settings-field-group.tsx");
    expect(src).toContain('"fieldset');
    expect(src).toContain("fieldset-legend");
  });
});
